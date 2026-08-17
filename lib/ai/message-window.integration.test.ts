import { chat } from "@tanstack/ai"
import type { ModelMessage, StreamChunk } from "@tanstack/ai"
import { memoryPersistence, withPersistence } from "@tanstack/ai-persistence"
import { describe, expect, it } from "vitest"

import { MAX_MODEL_MESSAGES, withMessageWindow } from "./message-window"

/**
 * The regression test for the one failure this design exists to avoid.
 *
 * The engine writes a middleware-transformed config back into `ctx.messages`
 * (`applyMiddlewareConfig`), and `withPersistence` saves exactly that array on
 * `onStart` and `onFinish`. So capping history in an `onConfig` hook — before
 * OR after the persistence middleware — would quietly truncate the STORED
 * transcript on every turn, converging it on a rolling window that can never
 * grow. Windowing at the adapter instead keeps the two concerns separate.
 *
 * This asserts both halves at once: the provider sees only the window, and the
 * store keeps everything. It uses in-memory persistence rather than Postgres —
 * the behaviour under test is the engine/middleware interaction, not SQL.
 */

// Minimal stand-in for a real provider: records what it was handed, then emits
// a single assistant message.
function stubAdapter(seen: Array<Array<ModelMessage>>) {
  return {
    kind: "text" as const,
    name: "stub",
    provider: "stub",
    model: "stub-model",
    async *chatStream(options: { messages: Array<ModelMessage> }) {
      seen.push(options.messages)
      const chunks: Array<StreamChunk> = [
        { type: "TEXT_MESSAGE_START", messageId: "m1", role: "assistant" },
        { type: "TEXT_MESSAGE_CONTENT", messageId: "m1", delta: "ok" },
        { type: "TEXT_MESSAGE_END", messageId: "m1" },
      ] as unknown as Array<StreamChunk>
      for (const chunk of chunks) yield chunk
    },
  }
}

const seeded = (count: number): Array<ModelMessage> =>
  Array.from({ length: count }, (_, i) =>
    i % 2 === 0
      ? ({ role: "user", content: `q${i}` } as ModelMessage)
      : ({ role: "assistant", content: `a${i}` } as ModelMessage)
  )

describe("adapter-level windowing vs persistence", () => {
  it("sends only the window to the provider while storing the full transcript", async () => {
    const persistence = memoryPersistence()
    const seen: Array<Array<ModelMessage>> = []
    const messages = seeded(20)
    const threadId = "t-window"

    const stream = chat({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub adapter
      adapter: withMessageWindow(stubAdapter(seen)) as any,
      messages,
      threadId,
      runId: "r-window",
      middleware: [withPersistence(persistence)],
    })
    // Drain: the middleware's terminal hooks (and therefore the save) only run
    // once the stream is fully consumed.
    for await (const chunk of stream) void chunk

    // The provider saw at most the window (plus the backwards extension to a
    // user turn, which cannot exceed the full transcript).
    expect(seen).toHaveLength(1)
    expect(seen[0]!.length).toBeLessThanOrEqual(MAX_MODEL_MESSAGES + 1)
    expect(seen[0]!.length).toBeLessThan(messages.length)

    // …and the store kept everything, plus the new assistant turn. This is the
    // assertion that fails (at ~11) the moment the cap moves into middleware.
    const stored = await persistence.stores.messages!.loadThread(threadId)
    expect(stored.length).toBeGreaterThan(messages.length)
  })
})
