import { relations, sql } from "drizzle-orm"
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

import { createdAt, updatedAt } from "./_shared"
import { tenants } from "./cms"

// Backing store for the copilot's conversation history (@tanstack/ai-persistence).
// The store contracts drive the shape here — see lib/ai/persistence.ts.

export const aiThreadKind = pgEnum("AiThreadKind", ["page", "post", "template"])

// Mirrors RunStatus from @tanstack/ai. 'interrupted' is deliberately NOT
// terminal: it is a human-in-the-loop pause awaiting a tool approval, which is
// a different thing from 'aborted'.
export const aiRunStatus = pgEnum("AiRunStatus", [
  "running",
  "interrupted",
  "completed",
  "failed",
  "aborted",
])

export const aiInterruptStatus = pgEnum("AiInterruptStatus", [
  "pending",
  "resolved",
  "cancelled",
])

/**
 * One rolling conversation per editable entity. `id` IS the threadId that the
 * wire and every store keys on (a signed value — see lib/ai/thread-id.ts).
 *
 * The whole transcript lives in one jsonb column because `MessageStore` is
 * `loadThread(threadId) -> ModelMessage[]` / `saveThread(threadId, messages)`,
 * a documented FULL REPLACE with no pagination and no per-message query. A
 * row-per-message table would turn each save — and there are 2-4 per turn —
 * into a DELETE plus N INSERTs. Same reasoning as pages.data / pages.draftData.
 *
 * Caveat: `saveThread` is a blind overwrite with no version token, so two
 * concurrent runs on one thread would clobber each other. That is fine for one
 * entity edited by one person, but do not reuse these tables for a
 * multi-participant chat without adding optimistic concurrency.
 */
export const aiChatThreads = pgTable(
  "ai_chat_threads",
  {
    id: text("id").primaryKey(),
    // Resolved server-side from (kind, contentId) via lib/cms/content-scope.ts,
    // NEVER taken from the request. Nullable because global templates have no
    // tenant, matching templates.tenantId.
    tenantId: text("tenantId").references(() => tenants.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    kind: aiThreadKind("kind").notNull(),
    contentId: text("contentId").notNull(),
    messages: jsonb("messages").notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ai_chat_threads_tenantId_idx").on(t.tenantId),
    // NOT unique: rotating CHAT_THREAD_SECRET mints a new id for the same
    // entity, and a unique constraint would turn that into a hard insert
    // failure instead of an orphaned row a sweep can clean up later.
    index("ai_chat_threads_kind_contentId_idx").on(t.kind, t.contentId),
    // Retention sweep: delete threads untouched for N days.
    index("ai_chat_threads_updatedAt_idx").on(t.updatedAt),
  ]
)

/**
 * RunRecord. A real table rather than more jsonb: it is queried by predicate
 * (findActiveRun) and patched field-by-field, so folding it into the thread row
 * would make that a jsonb scan AND turn every status patch into a
 * read-modify-write of the transcript — a lost-update race.
 *
 * The SDK models timestamps as epoch ms; they are stored as TIMESTAMP(3), which
 * is exactly millisecond precision (lossless) and readable in psql. Conversion
 * happens at the store boundary.
 */
export const aiChatRuns = pgTable(
  "ai_chat_runs",
  {
    runId: text("runId").primaryKey(),
    threadId: text("threadId")
      .notNull()
      .references(() => aiChatThreads.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: aiRunStatus("status").notNull(),
    startedAt: timestamp("startedAt", { precision: 3, mode: "date" }).notNull(),
    finishedAt: timestamp("finishedAt", { precision: 3, mode: "date" }),
    // RunError is structured; a bare provider message would be unbranched prose.
    errorMessage: text("errorMessage"),
    errorCode: text("errorCode"),
    usage: jsonb("usage"),
    // Round-tripped for contract completeness. Only written by the sandbox
    // middleware, which this app does not use.
    sandboxKey: text("sandboxKey"),
    detachedSince: timestamp("detachedSince", { precision: 3, mode: "date" }),
    cancelRequested: boolean("cancelRequested"),
    driverEpoch: integer("driverEpoch"),
  },
  (t) => [
    // findActiveRun: threadId + status='running' ordered by startedAt DESC.
    // Partial, so this stays an index-only probe as runs accumulate.
    index("ai_chat_runs_active_idx")
      .on(t.threadId, t.startedAt.desc())
      .where(sql`${t.status} = 'running'`),
    index("ai_chat_runs_threadId_startedAt_idx").on(t.threadId, t.startedAt),
    index("ai_chat_runs_detachedSince_idx")
      .on(t.detachedSince)
      .where(sql`${t.status} = 'running'`),
  ]
)

/**
 * InterruptRecord. The approval-gated copilot tools pause here, so a reload has
 * to find the pending row and re-prompt the same decision.
 *
 * The listers order by `requestedAt`, per the store contract. `seq` is the
 * tiebreaker, not decoration: the persistence middleware creates a whole batch
 * of interrupts inside one loop, so several land on the same millisecond and
 * would otherwise come back in an arbitrary order.
 */
export const aiChatInterrupts = pgTable(
  "ai_chat_interrupts",
  {
    interruptId: text("interruptId").primaryKey(),
    // Deliberately NOT a foreign key to ai_chat_runs. The store contract does
    // not order interrupt creation after run creation — an interrupt may be
    // recorded for a run the runs store never saw — so an FK here rejects
    // legitimate writes (the package's conformance suite fails on it). The
    // cascade that matters comes from `threadId` below, and runs are never
    // deleted independently of their thread.
    runId: text("runId").notNull(),
    threadId: text("threadId")
      .notNull()
      .references(() => aiChatThreads.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    status: aiInterruptStatus("status").notNull().default("pending"),
    requestedAt: timestamp("requestedAt", {
      precision: 3,
      mode: "date",
    }).notNull(),
    resolvedAt: timestamp("resolvedAt", { precision: 3, mode: "date" }),
    payload: jsonb("payload").notNull(),
    response: jsonb("response"),
    seq: bigserial("seq", { mode: "number" }).notNull(),
  },
  (t) => [
    // Match the listers' ORDER BY exactly: requestedAt first (the contract's
    // ordering), seq only as the same-millisecond tiebreaker.
    index("ai_chat_interrupts_threadId_seq_idx").on(
      t.threadId,
      t.requestedAt,
      t.seq
    ),
    index("ai_chat_interrupts_pending_thread_idx")
      .on(t.threadId, t.requestedAt, t.seq)
      .where(sql`${t.status} = 'pending'`),
    index("ai_chat_interrupts_runId_seq_idx").on(t.runId, t.requestedAt, t.seq),
    index("ai_chat_interrupts_pending_run_idx")
      .on(t.runId, t.requestedAt, t.seq)
      .where(sql`${t.status} = 'pending'`),
  ]
)

/**
 * App-owned KV for the persistence layer. NOT thread-scoped by contract — the
 * first argument is an app-defined namespace string, not a threadId — so
 * deliberately no FK and no cascade. A thread delete does not reap its
 * metadata; do that explicitly if you ever store any.
 *
 * The composite key is two independent fields, so it gets a composite primary
 * key rather than a `${namespace}:${key}` string, which would collide whenever
 * either half contains a colon.
 */
export const aiChatMetadata = pgTable(
  "ai_chat_metadata",
  {
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    value: jsonb("value"),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({
      name: "ai_chat_metadata_pkey",
      columns: [t.namespace, t.key],
    }),
  ]
)

export const aiChatThreadsRelations = relations(
  aiChatThreads,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [aiChatThreads.tenantId],
      references: [tenants.id],
    }),
    runs: many(aiChatRuns),
    interrupts: many(aiChatInterrupts),
  })
)

export const aiChatRunsRelations = relations(aiChatRuns, ({ one, many }) => ({
  thread: one(aiChatThreads, {
    fields: [aiChatRuns.threadId],
    references: [aiChatThreads.id],
  }),
  interrupts: many(aiChatInterrupts),
}))

export const aiChatInterruptsRelations = relations(
  aiChatInterrupts,
  ({ one }) => ({
    thread: one(aiChatThreads, {
      fields: [aiChatInterrupts.threadId],
      references: [aiChatThreads.id],
    }),
    run: one(aiChatRuns, {
      fields: [aiChatInterrupts.runId],
      references: [aiChatRuns.runId],
    }),
  })
)

export type AiChatThread = typeof aiChatThreads.$inferSelect
export type AiChatRun = typeof aiChatRuns.$inferSelect
export type AiChatInterrupt = typeof aiChatInterrupts.$inferSelect
