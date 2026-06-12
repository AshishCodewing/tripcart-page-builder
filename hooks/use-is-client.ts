import * as React from "react"

const emptySubscribe = () => () => {}

/**
 * Returns `false` on the server and during the first client render, then
 * `true` once hydrated — without a setState-in-effect. This is React's
 * sanctioned way to gate client-only UI (browser-only widgets, post-hydration
 * theme, current-time formatting) past hydration: a `useSyncExternalStore`
 * with a server snapshot triggers the same single post-hydration re-render an
 * effect would, but satisfies the `react-hooks/set-state-in-effect` rule.
 * See https://react.dev/reference/react/useSyncExternalStore
 */
export function useIsClient() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}
