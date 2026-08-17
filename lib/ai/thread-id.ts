import "server-only"

import { createId } from "@paralleldrive/cuid2"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Copilot conversation ids.
 *
 * One rolling conversation per editable entity, so the thread id has to be
 * derived from `(kind, contentId)` rather than minted per session. The naive
 * form — `page:<cuid>` — would make the id trivially guessable: that cuid is
 * already visible in the editor URL, in browser history, and in trace metadata.
 * Since `GET /api/chat?threadId=…` returns the whole transcript and the app has
 * no session yet (see the TODO(auth) markers), a guessable id would mean anyone
 * who has seen an editor URL could read that entity's chat history.
 *
 * So the id is signed and minted SERVER-SIDE only: possession of a valid id is
 * proof the server handed it to whoever loaded the editor page. It is a bearer
 * capability, not an identifier — do not log it or hand it to third parties
 * (the Langfuse session id deliberately uses the unsigned scope instead).
 *
 * This is scaffolding for a real session check, not a replacement for one.
 */

export const THREAD_KINDS = ["page", "post", "template"] as const

export type ThreadKind = (typeof THREAD_KINDS)[number]

export type ThreadScope = {
  kind: ThreadKind
  contentId: string
  /**
   * Which conversation on that record. A record holds many conversations (the
   * history switcher), so identity is (kind, contentId, conversationId) — the
   * entity alone is a scope, not a thread.
   */
  conversationId: string
}

// Hex, not base64url: the id is `_`-delimited and the base64url alphabet
// includes `_`, which would make the split ambiguous. 128 bits is far more
// than a forgery budget needs.
const SIGNATURE_BYTES = 16

function secret(): Buffer {
  const value = process.env.CHAT_THREAD_SECRET
  if (!value) {
    throw new Error(
      "CHAT_THREAD_SECRET is not set — copilot thread ids cannot be signed."
    )
  }
  return Buffer.from(value, "utf8")
}

function sign(scope: ThreadScope): string {
  return createHmac("sha256", secret())
    .update(`${scope.kind}:${scope.contentId}:${scope.conversationId}`)
    .digest("hex")
    .slice(0, SIGNATURE_BYTES * 2)
}

/** The unsigned scope string. Safe to log; use it for trace/session ids. */
export function threadScopeKey(scope: ThreadScope): string {
  return `${scope.kind}:${scope.contentId}:${scope.conversationId}`
}

/**
 * Mint the conversation id for an entity. Server-only by construction (it needs
 * the secret) — the browser must receive this as a prop, never derive it.
 */
export function buildThreadId(scope: ThreadScope): string {
  return `${scope.kind}_${scope.contentId}_${scope.conversationId}_${sign(scope)}`
}

/** A brand-new conversation on a record. No row exists until its first save. */
export function newThreadId(kind: ThreadKind, contentId: string): string {
  return buildThreadId({ kind, contentId, conversationId: createId() })
}

/** Verified scope, or null when the id is malformed or unsigned by us. */
export function tryParseThreadId(threadId: string): ThreadScope | null {
  const parts = threadId.split("_")
  if (parts.length !== 4) return null

  const [kind, contentId, conversationId, signature] = parts as [
    string,
    string,
    string,
    string,
  ]
  if (!isThreadKind(kind) || !contentId || !conversationId) return null

  const expected = sign({ kind, contentId, conversationId })
  // Equal length is a precondition of timingSafeEqual, and a length mismatch
  // is not a secret worth constant-time treatment.
  if (signature.length !== expected.length) return null
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null
  }
  return { kind, contentId, conversationId }
}

/** As {@link tryParseThreadId}, but throws — for store writes that must not
 * invent a thread row for an id we never issued. */
export function parseThreadId(threadId: string): ThreadScope {
  const scope = tryParseThreadId(threadId)
  if (!scope) {
    throw new Error(`Not a valid copilot thread id: ${threadId}`)
  }
  return scope
}

function isThreadKind(value: string): value is ThreadKind {
  return (THREAD_KINDS as ReadonlyArray<string>).includes(value)
}
