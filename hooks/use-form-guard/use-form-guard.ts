import { useCallback, useEffect, useRef } from "react"
import type { UseFormGuardOptions, UseFormGuardResult } from "./types"

const DEFAULT_MESSAGE =
  "You have unsaved changes. Are you sure you want to leave?"

// Marker carried on the history `state` of the back/forward sentinel entry
// (see the popstate effect). Lets us tell our own seeded entry apart from a
// real one so we don't stack duplicates across re-mounts.
const SENTINEL_STATE = { __formGuardSentinel: true } as const

function isSentinelState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    "__formGuardSentinel" in state
  )
}

function normalizeOptions(
  isDirtyOrOptions: boolean | UseFormGuardOptions,
  baseOptions: Omit<UseFormGuardOptions, "isDirty"> = {}
): UseFormGuardOptions {
  if (typeof isDirtyOrOptions === "boolean") {
    return { isDirty: isDirtyOrOptions, ...baseOptions }
  }
  return isDirtyOrOptions
}

/**
 * useFormGuard
 *
 * Covers:
 * - Browser tab close/refresh (beforeunload) — opt out with `guardUnload: false`
 * - Browser back / forward button (popstate)
 *
 * Client-side soft navigation (Next.js `<Link>` / `router.push`) is NOT
 * intercepted globally — that used to require monkey-patching
 * `history.pushState`, but since Next.js 15.3 the official `onNavigate` prop
 * handles it. Spread the returned `onNavigate` onto the links you want
 * guarded:
 *
 * @example
 * const { onNavigate } = useFormGuard(isDirty)
 * return <Link href="/elsewhere" onNavigate={onNavigate}>Back</Link>
 *
 * @example
 * useFormGuard({ isDirty, onBlock: () => openConfirmModal() })
 *
 * @example
 * // Another layer (e.g. GrapesJS noticeOnUnload) already handles tab
 * // close/refresh — guard only back/forward + links:
 * useFormGuard({ isDirty, guardUnload: false })
 */

export function useFormGuard(
  isDirty: boolean,
  options?: Omit<UseFormGuardOptions, "isDirty">
): UseFormGuardResult
export function useFormGuard(options: UseFormGuardOptions): UseFormGuardResult
export function useFormGuard(
  isDirtyOrOptions: boolean | UseFormGuardOptions,
  baseOptions?: Omit<UseFormGuardOptions, "isDirty">
): UseFormGuardResult {
  const {
    isDirty,
    message = DEFAULT_MESSAGE,
    enabled = true,
    guardUnload = true,
    onBlock,
  } = normalizeOptions(isDirtyOrOptions, baseOptions)

  const shouldBlock = enabled && isDirty

  // Use refs for the latest values inside event listeners (avoids stale closures)
  const shouldBlockRef = useRef(shouldBlock)
  const onBlockRef = useRef(onBlock)
  const messageRef = useRef(message)

  // Keep the refs in sync with the latest render. `useRef(initial)` only
  // applies `initial` on the first render, so without this the listeners
  // below would read stale values (e.g. shouldBlock frozen at its initial
  // `false`, leaving the guard permanently disarmed).
  useEffect(() => {
    shouldBlockRef.current = shouldBlock
    onBlockRef.current = onBlock
    messageRef.current = message
  })

  // 1. beforeunload: before browser tab close/refresh
  //
  // Skipped entirely when `guardUnload` is false — e.g. GrapesJS's
  // `noticeOnUnload` already attaches its own onbeforeunload prompt.

  useEffect(() => {
    if (typeof window === "undefined" || !guardUnload) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldBlockRef.current) return
      // standard way to trigger browser's native "leave site?" dialog
      // Modern browsers ignore the custom returnValue string for security reasons.
      e.preventDefault()
      e.returnValue = messageRef.current
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [guardUnload]) // shouldBlockRef handles dirty reactivity; re-run only to (de)attach

  // 2. Client-side soft navigation: handled via the returned `onNavigate`
  //    (Next.js 15.3+ <Link onNavigate> / router), not by patching history.
  //    See `onNavigate` below.

  // 3. popstate: browser back / forward button
  //
  // The naive "reverse it after the fact" approach (history.go(1) then
  // confirm) fights client routers like the Next.js App Router, which commit
  // the soft navigation the instant popstate fires — so cancelling can't
  // reliably undo it. Instead we seed a *sentinel* history entry that points
  // at the current URL. Pressing Back pops the sentinel rather than leaving
  // the page; because the URL is unchanged, the router performs no visible
  // navigation, and we get to ask first. Confirm => history.back() for real;
  // cancel => re-seed the sentinel and stay put.
  useEffect(() => {
    if (typeof window === "undefined") return

    // Seed one sentinel so the first Back press has something to pop.
    // Guard against stacking duplicates: React StrictMode mounts effects
    // twice in dev, and a duplicate sentinel would make `leave()` below pop
    // one entry too few and never escape the page. Only seed when the current
    // entry isn't already ours.
    if (!isSentinelState(window.history.state)) {
      window.history.pushState(SENTINEL_STATE, "", window.location.href)
    }

    // Set when WE call history.back() programmatically, so the resulting
    // popstate is consumed without re-prompting.
    let bypassNext = false

    const handlePopState = () => {
      if (bypassNext) {
        bypassNext = false
        return
      }

      // Nothing to guard: the sentinel was just swallowing one Back press,
      // so finish the navigation the user actually intended.
      if (!shouldBlockRef.current) {
        bypassNext = true
        window.history.back()
        return
      }

      const leave = () => {
        bypassNext = true
        window.history.back()
      }
      const stay = () => {
        // Re-seed so the URL stays here and we remain armed for the next press.
        window.history.pushState(SENTINEL_STATE, "", window.location.href)
      }

      if (onBlockRef.current) {
        onBlockRef.current().then((confirmed) => (confirmed ? leave() : stay()))
      } else if (window.confirm(messageRef.current)) {
        leave()
      } else {
        stay()
      }
    }

    window.addEventListener("popstate", handlePopState)
    return () => {
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  // Handler for Next.js `<Link onNavigate>` (15.3+). onNavigate is synchronous,
  // so only the native `confirm()` path can cancel a navigation here — an async
  // `onBlock` modal can't, since we'd have to return before it resolves. Wire
  // `onBlock` for the back/forward path; use confirm for guarded links.
  const onNavigate = useCallback((event: { preventDefault: () => void }) => {
    if (!shouldBlockRef.current) return
    if (!window.confirm(messageRef.current)) {
      event.preventDefault()
    }
  }, [])

  return { isBlocked: shouldBlock, onNavigate }
}
