import type { StyleContext } from "./use-style-context"

// Map of CSS property name → predicate. If a property name appears here, its
// row is rendered only when the predicate returns true. Properties not listed
// are always visible (subject to the property's own `isVisible()` flag).
//
// The split mirrors the Studio SDK's `Mq` renderer: flex-container properties
// gate on the selected element being a flex container, flex-child properties
// gate on the parent being a flex container.
const VISIBILITY: Record<string, (ctx: StyleContext) => boolean> = {
  // Flex container — visible when this element computes display: flex.
  "flex-direction": (ctx) => ctx.isFlex,
  "justify-content": (ctx) => ctx.isFlex,
  "align-items": (ctx) => ctx.isFlex,
  gap: (ctx) => ctx.isFlex,
  "row-gap": (ctx) => ctx.isFlex,
  "column-gap": (ctx) => ctx.isFlex,
  "flex-wrap": (ctx) => ctx.isFlex,
  // Only meaningful on multi-line flex containers.
  "align-content": (ctx) => ctx.isFlex && ctx.flexWrap !== "nowrap",

  // Flex child — visible when the parent is a flex container.
  "align-self": (ctx) => ctx.parentIsFlex,
  order: (ctx) => ctx.parentIsFlex,
  flex: (ctx) => ctx.parentIsFlex,
  "flex-grow": (ctx) => ctx.parentIsFlex,
  "flex-shrink": (ctx) => ctx.parentIsFlex,
  "flex-basis": (ctx) => ctx.parentIsFlex,

  // Position offsets are only meaningful when position is non-static.
  top: (ctx) => ctx.position !== "static",
  right: (ctx) => ctx.position !== "static",
  bottom: (ctx) => ctx.position !== "static",
  left: (ctx) => ctx.position !== "static",
}

export function isPropertyVisible(name: string, ctx: StyleContext): boolean {
  const fn = VISIBILITY[name]
  return fn ? fn(ctx) : true
}
