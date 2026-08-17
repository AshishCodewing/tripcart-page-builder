"use client"

import * as React from "react"

import { useIsClient } from "@/hooks/use-is-client"

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const absSec = Math.abs(diffMs) / 1000
  if (absSec < 60) return RTF.format(Math.round(diffMs / 1000), "second")
  if (absSec < 3600) return RTF.format(Math.round(diffMs / 60_000), "minute")
  if (absSec < 86_400) return RTF.format(Math.round(diffMs / 3_600_000), "hour")
  return RTF.format(Math.round(diffMs / 86_400_000), "day")
}

export function RelativeTime({ date }: { date: Date }) {
  // `formatRelative` reads `Date.now()`, which differs between server and
  // client, so render an empty string until hydrated to avoid a mismatch.
  const isClient = useIsClient()
  // Re-render every 30s to keep the relative label fresh. The tick is a
  // timer callback (not a synchronous effect-body setState), and the label
  // itself is derived during render rather than mirrored into state.
  const [, tick] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return <>{isClient ? formatRelative(date) : ""}</>
}
