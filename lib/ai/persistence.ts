import "server-only"

import { defineRunStore, isRunStatus } from "@tanstack/ai"
import type { ModelMessage, RunRecord } from "@tanstack/ai"
import {
  defineAIPersistence,
  defineInterruptStore,
  defineMessageStore,
  defineMetadataStore,
} from "@tanstack/ai-persistence"
import type { InterruptRecord } from "@tanstack/ai-persistence"
import { and, asc, desc, eq, isNotNull, lte } from "drizzle-orm"

import { resolveContentTenantId } from "@/lib/cms/content-scope"
import { db, type Db } from "@/lib/db"
import {
  aiChatInterrupts,
  aiChatMetadata,
  aiChatRuns,
  aiChatThreads,
} from "@/lib/schema"
import { parseThreadId, type ThreadKind } from "./thread-id"

/**
 * Postgres backing for the copilot's conversation history.
 *
 * The middleware writes through these stores in a fixed order that the schema
 * has to tolerate — see {@link ensureThread}.
 */

// ── Thread bootstrap ─────────────────────────────────────────────────────────

/**
 * Where a thread row's identity columns come from. Injectable purely so the
 * conformance suite can exercise the real stores with synthetic thread ids —
 * production always uses {@link resolveScopeFromCms}.
 */
export type ThreadScopeResolver = (threadId: string) => Promise<{
  kind: ThreadKind
  contentId: string
  tenantId: string | null
}>

/**
 * The tenant is read from the CMS tables, never from the caller. Together with
 * `parseThreadId` rejecting an unsigned id, this is what stops a transcript
 * being filed against an invented content id.
 */
const resolveScopeFromCms: ThreadScopeResolver = async (threadId) => {
  const scope = parseThreadId(threadId)
  const tenantId = await resolveContentTenantId(scope.kind, scope.contentId)
  return { ...scope, tenantId }
}

// ── Messages ─────────────────────────────────────────────────────────────────

/**
 * jsonb round-trips a Date to an ISO string, and the SDK copies `createdAt`
 * through verbatim when converting to UI messages — so without this a restored
 * message carries a string where consumers expect a Date.
 */
function reviveMessages(raw: unknown): Array<ModelMessage> {
  if (!Array.isArray(raw)) return []
  return raw.map((message) => {
    const created = (message as { createdAt?: unknown }).createdAt
    return typeof created === "string"
      ? { ...(message as ModelMessage), createdAt: new Date(created) }
      : (message as ModelMessage)
  })
}

// ── Runs ─────────────────────────────────────────────────────────────────────

function toRunRecord(row: typeof aiChatRuns.$inferSelect): RunRecord {
  // The enum column is a compile-time claim about what is stored. Validate on
  // the way OUT, because readers act destructively on a terminal answer.
  if (!isRunStatus(row.status)) {
    throw new Error(`ai_chat_runs.status is not a RunStatus: ${row.status}`)
  }
  return {
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    startedAt: row.startedAt.getTime(),
    ...(row.finishedAt ? { finishedAt: row.finishedAt.getTime() } : {}),
    ...(row.errorMessage
      ? {
          error: {
            message: row.errorMessage,
            ...(row.errorCode ? { code: row.errorCode } : {}),
          },
        }
      : {}),
    ...(row.usage ? { usage: row.usage as RunRecord["usage"] } : {}),
    ...(row.sandboxKey ? { sandboxKey: row.sandboxKey } : {}),
    ...(row.detachedSince
      ? { detachedSince: row.detachedSince.getTime() }
      : {}),
    ...(row.cancelRequested != null
      ? { cancelRequested: row.cancelRequested }
      : {}),
    ...(row.driverEpoch != null ? { driverEpoch: row.driverEpoch } : {}),
  }
}

// ── Interrupts ───────────────────────────────────────────────────────────────

function toInterruptRecord(
  row: typeof aiChatInterrupts.$inferSelect
): InterruptRecord {
  return {
    interruptId: row.interruptId,
    runId: row.runId,
    threadId: row.threadId,
    status: row.status,
    requestedAt: row.requestedAt.getTime(),
    // Must be ABSENT while pending, not null.
    ...(row.resolvedAt ? { resolvedAt: row.resolvedAt.getTime() } : {}),
    payload: row.payload as Record<string, unknown>,
    ...(row.response != null ? { response: row.response } : {}),
  }
}

// Ordered by `requestedAt` per the contract, with `seq` as the tiebreaker:
// the middleware creates a whole batch of interrupts inside one loop, so
// several land on the same millisecond and only the insertion sequence keeps
// them stably ordered.
async function listInterrupts(filter: {
  threadId?: string
  runId?: string
  pending?: boolean
}): Promise<Array<InterruptRecord>> {
  const scope = filter.threadId
    ? eq(aiChatInterrupts.threadId, filter.threadId)
    : eq(aiChatInterrupts.runId, filter.runId!)
  const rows = await db
    .select()
    .from(aiChatInterrupts)
    .where(
      filter.pending
        ? and(scope, eq(aiChatInterrupts.status, "pending"))
        : scope
    )
    .orderBy(asc(aiChatInterrupts.requestedAt), asc(aiChatInterrupts.seq))
  return rows.map(toInterruptRecord)
}

export function createChatPersistence(
  resolveScope: ThreadScopeResolver = resolveScopeFromCms
) {
  /**
   * Materialize the thread row if it does not exist yet.
   *
   * Called by EVERY store write, because the persistence middleware's onConfig
   * creates the RUN record before onStart writes the first transcript. On a
   * brand-new thread the run insert therefore lands before the thread row
   * exists, and its foreign key would fail with a 23503. ON CONFLICT DO
   * NOTHING keeps this idempotent and safe against two runs racing to create
   * the same thread.
   */
  async function ensureThread(tx: Db, threadId: string): Promise<void> {
    const scope = await resolveScope(threadId)
    await tx
      .insert(aiChatThreads)
      .values({
        id: threadId,
        tenantId: scope.tenantId,
        kind: scope.kind,
        contentId: scope.contentId,
      })
      .onConflictDoNothing({ target: aiChatThreads.id })
  }

  const messages = defineMessageStore({
    async loadThread(threadId) {
      const row = await db.query.aiChatThreads.findFirst({
        where: eq(aiChatThreads.id, threadId),
        columns: { messages: true },
      })
      // Contract: an unknown thread is an empty transcript, never null.
      return reviveMessages(row?.messages)
    },

    async saveThread(threadId, list) {
      await db.transaction(async (tx) => {
        await ensureThread(tx, threadId)
        await tx
          .update(aiChatThreads)
          .set({ messages: list, updatedAt: new Date() })
          .where(eq(aiChatThreads.id, threadId))
      })
    },
  })

  const runs = defineRunStore({
    async createOrResume(input) {
      return db.transaction(async (tx) => {
        await ensureThread(tx, input.threadId)
        const [inserted] = await tx
          .insert(aiChatRuns)
          .values({
            runId: input.runId,
            threadId: input.threadId,
            status: input.status ?? "running",
            startedAt: new Date(input.startedAt),
          })
          .onConflictDoNothing({ target: aiChatRuns.runId })
          .returning()
        if (inserted) return toRunRecord(inserted)

        // Conflict: the run already exists, so this is a RESUME. Return the
        // stored row untouched — ignoring the incoming status/startedAt is
        // exactly what makes repeated calls idempotent.
        const [existing] = await tx
          .select()
          .from(aiChatRuns)
          .where(eq(aiChatRuns.runId, input.runId))
        if (!existing) {
          throw new Error(`Run ${input.runId} vanished during createOrResume`)
        }
        return toRunRecord(existing)
      })
    },

    async update(runId, patch) {
      const set: Partial<typeof aiChatRuns.$inferInsert> = {}

      // Presence of a KEY means "write this", including when its value is
      // `undefined` — that is how a field gets cleared. Testing
      // `patch.x !== undefined` instead would silently keep the old value: a
      // run that was re-attached (`{ detachedSince: undefined }`) would still
      // look detached, and the reaper would cancel a run someone is watching.
      const has = (key: keyof typeof patch) => key in patch

      if (has("status") && patch.status !== undefined) set.status = patch.status
      if (has("finishedAt")) {
        set.finishedAt =
          patch.finishedAt === undefined ? null : new Date(patch.finishedAt)
      }
      if (has("error")) {
        set.errorMessage = patch.error?.message ?? null
        set.errorCode = patch.error?.code ?? null
      }
      if (has("usage")) set.usage = patch.usage ?? null
      if (has("sandboxKey")) set.sandboxKey = patch.sandboxKey ?? null
      if (has("detachedSince")) {
        set.detachedSince =
          patch.detachedSince === undefined
            ? null
            : new Date(patch.detachedSince)
      }
      if (has("cancelRequested")) {
        set.cancelRequested = patch.cancelRequested ?? null
      }
      if (has("driverEpoch")) set.driverEpoch = patch.driverEpoch ?? null

      // Drizzle throws on an empty `.set({})`, and an empty patch has to be a
      // silent no-op. An unknown runId is also a no-op: never throws, never
      // creates.
      if (Object.keys(set).length === 0) return
      await db.update(aiChatRuns).set(set).where(eq(aiChatRuns.runId, runId))
    },

    async get(runId) {
      const [row] = await db
        .select()
        .from(aiChatRuns)
        .where(eq(aiChatRuns.runId, runId))
      return row ? toRunRecord(row) : null
    },

    async listByThread(threadId) {
      const rows = await db
        .select()
        .from(aiChatRuns)
        .where(eq(aiChatRuns.threadId, threadId))
        .orderBy(asc(aiChatRuns.startedAt))
      return rows.map(toRunRecord)
    },

    async listReclaimable({ now, ttlMs }) {
      // Inclusive cutoff, per contract. Never fires without the sandbox
      // middleware, but stubbing it would be a lie the conformance suite catches.
      const rows = await db
        .select()
        .from(aiChatRuns)
        .where(
          and(
            eq(aiChatRuns.status, "running"),
            isNotNull(aiChatRuns.detachedSince),
            lte(aiChatRuns.detachedSince, new Date(now - ttlMs))
          )
        )
      return rows.map(toRunRecord)
    },

    /**
     * Most recent still-running run for a thread — the whole basis of reconnect.
     * Backed by the partial index ai_chat_runs_active_idx, so this stays an
     * index-only probe. Implemented honestly rather than stubbed to null: a stub
     * would silently and permanently disable reconnect in a way that looks
     * identical to an idle thread. The route decides whether to act on the
     * answer (see app/api/chat/route.ts).
     */
    async findActiveRun(threadId) {
      const [row] = await db
        .select()
        .from(aiChatRuns)
        .where(
          and(
            eq(aiChatRuns.threadId, threadId),
            eq(aiChatRuns.status, "running")
          )
        )
        .orderBy(desc(aiChatRuns.startedAt))
        .limit(1)
      return row ? toRunRecord(row) : null
    },
  })

  const interrupts = defineInterruptStore({
    async create(record) {
      await db.transaction(async (tx) => {
        await ensureThread(tx, record.threadId)
        // Insert-if-absent, NOT upsert: a duplicate create must never flip an
        // already-resolved interrupt back to pending.
        await tx
          .insert(aiChatInterrupts)
          .values({
            interruptId: record.interruptId,
            runId: record.runId,
            threadId: record.threadId,
            status: "pending",
            requestedAt: new Date(record.requestedAt),
            payload: record.payload,
          })
          .onConflictDoNothing({ target: aiChatInterrupts.interruptId })
      })
    },

    async resolve(interruptId, response) {
      await db
        .update(aiChatInterrupts)
        .set({
          status: "resolved",
          resolvedAt: new Date(),
          // Only write when supplied — `undefined` must not blank a stored value.
          ...(response !== undefined ? { response } : {}),
        })
        .where(eq(aiChatInterrupts.interruptId, interruptId))
    },

    async cancel(interruptId) {
      await db
        .update(aiChatInterrupts)
        .set({ status: "cancelled", resolvedAt: new Date() })
        .where(eq(aiChatInterrupts.interruptId, interruptId))
    },

    async get(interruptId) {
      const [row] = await db
        .select()
        .from(aiChatInterrupts)
        .where(eq(aiChatInterrupts.interruptId, interruptId))
      return row ? toInterruptRecord(row) : null
    },

    list: (threadId) => listInterrupts({ threadId }),
    listPending: (threadId) => listInterrupts({ threadId, pending: true }),
    listByRun: (runId) => listInterrupts({ runId }),
    listPendingByRun: (runId) => listInterrupts({ runId, pending: true }),
  })

  const metadata = defineMetadataStore({
    async get(namespace, key) {
      const [row] = await db
        .select({ value: aiChatMetadata.value })
        .from(aiChatMetadata)
        .where(
          and(
            eq(aiChatMetadata.namespace, namespace),
            eq(aiChatMetadata.key, key)
          )
        )
      return row?.value ?? null
    },

    async set(namespace, key, value) {
      await db
        .insert(aiChatMetadata)
        .values({ namespace, key, value })
        .onConflictDoUpdate({
          target: [aiChatMetadata.namespace, aiChatMetadata.key],
          set: { value, updatedAt: new Date() },
        })
    },

    async delete(namespace, key) {
      await db
        .delete(aiChatMetadata)
        .where(
          and(
            eq(aiChatMetadata.namespace, namespace),
            eq(aiChatMetadata.key, key)
          )
        )
    },
  })

  return defineAIPersistence({
    stores: { messages, runs, interrupts, metadata },
  })
}

export const chatPersistence = createChatPersistence()

/**
 * Wipe a conversation. The thread row cascades to its runs and interrupts, so
 * one delete is the whole operation.
 *
 * Needed because the client's `clear()` is purely local: under
 * `persistence: true` there is no client persistor, so nothing would otherwise
 * tell the server and the next mount would restore everything.
 */
export async function deleteThread(threadId: string): Promise<void> {
  await db.delete(aiChatThreads).where(eq(aiChatThreads.id, threadId))
}

/**
 * Reap every conversation belonging to an entity that is being deleted.
 *
 * Keyed on the `(kind, contentId)` columns rather than a rebuilt thread id, so
 * this also catches transcripts filed under a superseded id after a
 * CHAT_THREAD_SECRET rotation. The tenant foreign key only cascades when a
 * whole tenant goes away, so a single page/post/template delete needs this.
 */
export async function deleteThreadsForContent(
  kind: ThreadKind,
  contentId: string
): Promise<void> {
  await db
    .delete(aiChatThreads)
    .where(
      and(eq(aiChatThreads.kind, kind), eq(aiChatThreads.contentId, contentId))
    )
}
