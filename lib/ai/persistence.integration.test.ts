import { runPersistenceConformance } from "@tanstack/ai-persistence/testkit"
import { like } from "drizzle-orm"
import { afterAll } from "vitest"

import { db } from "@/lib/db"
import { aiChatMetadata, aiChatThreads } from "@/lib/schema"
import { createChatPersistence } from "./persistence"

/**
 * Runs the package's own conformance suite against the real Postgres stores.
 *
 * The suite exercises every contract invariant the stores have to honour —
 * insert-if-absent interrupts, idempotent `createOrResume`, no-op `update` on
 * an unknown run, `findActiveRun` picking the most recent running run, stable
 * lister ordering — which is exactly the surface that is easy to get subtly
 * wrong and impossible to notice until a conversation fails to restore.
 *
 * The scope resolver is stubbed because the suite invents thread ids, and
 * production's resolver deliberately rejects any id it did not sign for an
 * entity that exists. Everything below that seam is the real implementation.
 */
// Stamped onto every row this suite creates so the cleanup below can target
// them precisely. The integration suite runs against the same database the app
// uses, so a blanket `DELETE FROM ai_chat_threads` would wipe real transcripts.
const MARKER = "conformance:"

const persistence = createChatPersistence(async (threadId) => ({
  kind: "page",
  contentId: `${MARKER}${threadId}`,
  // Unscoped: the tenant FK is nullable, so no tenant row is needed.
  tenantId: null,
}))

runPersistenceConformance(
  "drizzle/postgres",
  async () => {
    // The suite reuses thread and run ids across cases, so rows left by an
    // earlier run would leak into assertions. Scoped to this suite's own rows
    // — the integration config points at the real database, and an unscoped
    // delete here would destroy live conversation history.
    await db
      .delete(aiChatThreads)
      .where(like(aiChatThreads.contentId, `${MARKER}%`))
    // Metadata has no FK to cascade through and the suite picks its own
    // namespaces, so this one is unavoidably a full clear. Safe only because
    // nothing in the app writes metadata yet — scope it the moment that
    // changes.
    await db.delete(aiChatMetadata)
    return persistence
  },
  {
    // Media-generation stores. The copilot generates HTML through a chat tool,
    // never images/audio/video, so there are no artifacts and no bytes to
    // store. Declared rather than silently absent — the suite fails any store
    // that is missing without being listed here.
    skip: ["generationRuns", "artifacts", "blobs"],
  }
)

// Leave the shared database as we found it — otherwise every run deposits a
// pile of synthetic threads next to real conversations.
afterAll(async () => {
  await db
    .delete(aiChatThreads)
    .where(like(aiChatThreads.contentId, `${MARKER}%`))
  await db.delete(aiChatMetadata)
})
