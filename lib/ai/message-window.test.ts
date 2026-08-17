import { describe, expect, it, vi } from "vitest"

import type { ModelMessage } from "@tanstack/ai"

import { windowMessages, withMessageWindow } from "./message-window"

const user = (content: string): ModelMessage => ({ role: "user", content })
const assistant = (content: string): ModelMessage => ({
  role: "assistant",
  content,
})
const tool = (content: string): ModelMessage =>
  ({ role: "tool", content }) as unknown as ModelMessage

describe("windowMessages", () => {
  it("returns the input untouched when it is already within the limit", () => {
    const messages = [user("a"), assistant("b")]
    expect(windowMessages(messages, 10)).toBe(messages)
  })

  it("keeps the last `limit` messages when the cut already lands on a user turn", () => {
    const messages = [
      user("1"),
      assistant("1"),
      user("2"),
      assistant("2"),
      user("3"),
      assistant("3"),
    ]
    expect(windowMessages(messages, 2)).toEqual([user("3"), assistant("3")])
  })

  it("extends backwards so the window starts on a user turn", () => {
    // A naive slice(-2) would start at the `tool` message, orphaning it from
    // the assistant turn that called it.
    const messages = [
      user("1"),
      assistant("1"),
      user("2"),
      assistant("calls tool"),
      tool("result"),
      assistant("done"),
    ]
    expect(windowMessages(messages, 2)).toEqual([
      user("2"),
      assistant("calls tool"),
      tool("result"),
      assistant("done"),
    ])
  })

  it("never orphans a tool message from its assistant turn", () => {
    const messages = [
      user("1"),
      assistant("calls tool"),
      tool("result"),
      assistant("done"),
    ]
    const windowed = windowMessages(messages, 2)
    const firstTool = windowed.findIndex((m) => m.role === "tool")
    if (firstTool !== -1) {
      expect(
        windowed.slice(0, firstTool).some((m) => m.role === "assistant")
      ).toBe(true)
    }
  })

  it("falls back to the whole list when no user turn precedes the cut", () => {
    const messages = [assistant("1"), assistant("2"), assistant("3")]
    expect(windowMessages(messages, 1)).toEqual(messages)
  })
})

describe("withMessageWindow", () => {
  it("windows the messages passed to chatStream", () => {
    const chatStream = vi.fn()
    const adapter = { name: "stub", chatStream }
    const messages = [user("1"), assistant("1"), user("2"), assistant("2")]

    withMessageWindow(adapter, 2).chatStream({ messages, model: "m" })

    expect(chatStream).toHaveBeenCalledWith({
      messages: [user("2"), assistant("2")],
      model: "m",
    })
  })

  it("windows structuredOutputStream too", () => {
    const structuredOutputStream = vi.fn()
    const adapter = { structuredOutputStream }
    const messages = [user("1"), assistant("1"), user("2"), assistant("2")]

    withMessageWindow(adapter, 2).structuredOutputStream({ messages })

    expect(structuredOutputStream).toHaveBeenCalledWith({
      messages: [user("2"), assistant("2")],
    })
  })

  it("passes non-message properties straight through", () => {
    const adapter = { name: "openrouter", provider: "openrouter" }
    const wrapped = withMessageWindow(adapter)
    expect(wrapped.name).toBe("openrouter")
    expect(wrapped.provider).toBe("openrouter")
  })

  it("keeps `this` bound to the real adapter", () => {
    class Adapter {
      readonly model = "gpt-5-mini"
      seen: string | undefined
      chatStream(options: { messages: Array<ModelMessage> }) {
        this.seen = this.model
        return options.messages
      }
    }
    const adapter = new Adapter()
    const wrapped = withMessageWindow(adapter, 1)

    wrapped.chatStream({ messages: [user("1"), user("2")] })

    expect(adapter.seen).toBe("gpt-5-mini")
  })
})
