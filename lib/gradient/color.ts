// Color sampling and stop-position helpers. sampleGradientColor is the only
// DOM-dependent function in the gradient module (uses a canvas).

import type { GradientStop } from "./types"

// Sample the gradient color at a given fraction of the timeline (0..1). This
// runs the stops through a CanvasGradient so we get the same interpolation
// CSS would, then reads back the pixel. Used to pick a sensible color when
// the user clicks an empty spot on the preview bar.
export function sampleGradientColor(
  stops: GradientStop[],
  pct: number
): string {
  if (typeof document === "undefined") return stops[0]?.color ?? "#000000"
  if (!stops.length) return "#000000"

  const clamped = Math.max(0, Math.min(1, pct))
  const width = 256
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = 1
  const ctx = canvas.getContext("2d")
  if (!ctx) return stops[0]?.color ?? "#000000"

  const grad = ctx.createLinearGradient(0, 0, width, 0)
  for (const stop of stops) {
    const raw = parseFloat(stop.position)
    if (!Number.isFinite(raw)) continue
    const t = Math.max(0, Math.min(1, raw / 100))
    try {
      grad.addColorStop(t, stop.color)
    } catch {
      // Unparseable color (e.g. var(--x)) — skip; sampling falls back to
      // whatever stops the canvas did accept.
    }
  }
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, width, 1)

  const x = Math.max(0, Math.min(width - 1, Math.round(clamped * (width - 1))))
  const [r, g, b, a] = ctx.getImageData(x, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`
}

// Extract a numeric percentage from a stop's position. Returns 0 when the
// position isn't a percentage (e.g. "10px") — the UI treats stop positions
// as percentages and we lose px precision in those cases, but we don't drop
// the stop on the floor.
export function stopPercent(position: string): number {
  const n = parseFloat(position)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

export function formatPercent(pct: number): string {
  // Match Grapick's behaviour of integer-snapping when close, but keep one
  // decimal of precision when the user drags through fractional positions.
  const rounded = Math.round(pct * 10) / 10
  return `${rounded}%`
}
