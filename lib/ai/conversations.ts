import "server-only"

import { and, desc, eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { aiChatThreads } from "@/lib/schema"
import {
  newThreadId,
  parseThreadId,
  tryParseThreadId,
  type ThreadKind,
} from "./thread-id"

/** One row in the assistant's history dropdown. */
export type ConversationSummary = {
  threadId: string
  /** First user message, trimmed for display; empty for a chat with no turns. */
  title: string
  messageCount: number
  updatedAt: Date
}

const TITLE_MAX = 80

/**
 * Every conversation on a record, newest first.
 *
 * The title and count are computed in SQL rather than by loading transcripts:
 * a record can hold many conversations and each `messages` document carries
 * whole tool loops, so selecting them all just to read the first line would
 * pull megabytes to render a dropdown.
 *
 * `content` is normally a string on the messages the client authors, but the
 * `ModelMessage` contract allows an array of parts — `->>` renders that as
 * JSON text, which is why the result is still trimmed and length-capped.
 */
export async function listConversations(
  kind: ThreadKind,
  contentId: string
): Promise<Array<ConversationSummary>> {
  const rows = await db
    .select({
      threadId: aiChatThreads.id,
      updatedAt: aiChatThreads.updatedAt,
      messageCount: sql<number>`jsonb_array_length(${aiChatThreads.messages})`,
      title: sql<string | null>`(
        select m ->> 'content'
        from jsonb_array_elements(${aiChatThreads.messages}) as m
        where m ->> 'role' = 'user'
        limit 1
      )`,
    })
    .from(aiChatThreads)
    .where(
      and(eq(aiChatThreads.kind, kind), eq(aiChatThreads.contentId, contentId))
    )
    .orderBy(desc(aiChatThreads.updatedAt))

  return rows.map((row) => ({
    threadId: row.threadId,
    title: (row.title ?? "").replace(/\s+/g, " ").trim().slice(0, TITLE_MAX),
    messageCount: Number(row.messageCount ?? 0),
    updatedAt: row.updatedAt,
  }))
}

/**
 * The conversation to open the editor on: the most recently touched one, or a
 * brand-new id when the record has never been chatted about.
 */
export async function resolveLatestThreadId(
  kind: ThreadKind,
  contentId: string
): Promise<string> {
  const [row] = await db
    .select({ id: aiChatThreads.id })
    .from(aiChatThreads)
    .where(
      and(eq(aiChatThreads.kind, kind), eq(aiChatThreads.contentId, contentId))
    )
    .orderBy(desc(aiChatThreads.updatedAt))
    .limit(1)

  // A stored id was minted under the current secret only if it still verifies;
  // after a CHAT_THREAD_SECRET rotation the old rows are unreachable and a
  // fresh conversation is the right answer.
  if (row && tryParseThreadId(row.id)) return row.id
  return newThreadId(kind, contentId)
}

/**
 * Sibling conversations of a thread the caller already holds.
 *
 * Taking the thread id rather than `(kind, contentId)` is deliberate: the id is
 * signed, so possession is what proves the caller was handed this record's
 * editor. A raw `(kind, contentId)` pair would let anyone enumerate any
 * record's conversations.
 */
export async function listSiblingConversations(
  threadId: string
): Promise<Array<ConversationSummary>> {
  const scope = parseThreadId(threadId)
  return listConversations(scope.kind, scope.contentId)
}

/** A fresh conversation on the same record as an existing thread. */
export function siblingThreadId(threadId: string): string {
  const scope = parseThreadId(threadId)
  return newThreadId(scope.kind, scope.contentId)
}
