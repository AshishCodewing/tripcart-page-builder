"use server"

import {
  listSiblingConversations,
  siblingThreadId,
  type ConversationSummary,
} from "./conversations"
import { deleteThread } from "./persistence"
import { parseThreadId } from "./thread-id"

/**
 * Actions backing the assistant's history dropdown.
 *
 * Each takes the caller's CURRENT thread id and derives the record from it.
 * That signed id is the capability: it proves the server handed this editor to
 * whoever is asking. Accepting a raw `(kind, contentId)` instead would let any
 * caller enumerate or delete another record's conversations — the same
 * exposure the GET route is guarded against.
 *
 * TODO(auth): replace the signature check with a session/tenant check once the
 * app has one; see the markers in app/api/chat/route.ts.
 */

export async function listConversationsAction(
  threadId: string
): Promise<Array<ConversationSummary>> {
  return listSiblingConversations(threadId)
}

export async function createConversationAction(
  threadId: string
): Promise<string> {
  // No row is written here — `ensureThread` creates one on the first save, so
  // abandoning a new chat without sending anything leaves nothing behind.
  return siblingThreadId(threadId)
}

/**
 * Delete one conversation from the history list.
 *
 * `parseThreadId` throws on an id this server did not sign, and that throw IS
 * the authorization check — it runs before anything touches the database.
 */
export async function deleteConversationAction(
  threadId: string
): Promise<void> {
  parseThreadId(threadId)
  await deleteThread(threadId)
}
