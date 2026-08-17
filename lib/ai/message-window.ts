import type { ModelMessage } from "@tanstack/ai"

/**
 * Cap the history sent to the model. Older turns add cost without improving
 * answers that are grounded in the (always-fresh) editor context.
 *
 * This deliberately does NOT live in a middleware. The engine writes whatever
 * `onConfig` returns back into `ctx.messages` (applyMiddlewareConfig), and the
 * persistence middleware saves exactly that array — so a middleware trim would
 * truncate the STORED transcript on every turn, permanently and silently.
 * Wrapping the adapter instead puts the window one layer below `ctx.messages`,
 * where only the provider request is affected.
 */
export const MAX_MODEL_MESSAGES = 10

/**
 * The last `limit` messages, extended backwards until the window starts on a
 * user turn.
 *
 * The extension is not cosmetic: cutting mid-turn can orphan a `tool` message
 * from the assistant message whose tool call produced it, and most providers
 * reject that outright. Stored transcripts now contain whole tool loops, so a
 * naive slice would hit this often.
 */
export function windowMessages(
  messages: Array<ModelMessage>,
  limit: number = MAX_MODEL_MESSAGES
): Array<ModelMessage> {
  if (messages.length <= limit) return messages

  let start = messages.length - limit
  while (start > 0 && messages[start]?.role !== "user") start--
  return messages.slice(start)
}

type StreamOptions = { messages: Array<ModelMessage> }

/**
 * Wrap a chat adapter so every provider request carries only the recent
 * window. `chatStream` and `structuredOutputStream` are the only two methods
 * the engine calls that take messages.
 */
export function withMessageWindow<T extends object>(
  adapter: T,
  limit: number = MAX_MODEL_MESSAGES
): T {
  return new Proxy(adapter, {
    get(target, prop) {
      // `target` as the Reflect receiver: getters must run against the real
      // adapter and prototype methods must keep their `this`.
      const value = Reflect.get(target, prop, target)
      if (
        (prop !== "chatStream" && prop !== "structuredOutputStream") ||
        typeof value !== "function"
      ) {
        return value
      }
      return (options: StreamOptions, ...rest: Array<unknown>) =>
        value.call(
          target,
          { ...options, messages: windowMessages(options.messages, limit) },
          ...rest
        )
    },
  })
}
