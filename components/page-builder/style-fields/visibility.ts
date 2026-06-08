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
  // Alignment + gap apply to both flex and grid containers.
  "justify-content": (ctx) => ctx.isFlex || ctx.isGrid,
  "align-items": (ctx) => ctx.isFlex || ctx.isGrid,
  gap: (ctx) => ctx.isFlex || ctx.isGrid,
  "row-gap": (ctx) => ctx.isFlex || ctx.isGrid,
  "column-gap": (ctx) => ctx.isFlex || ctx.isGrid,
  "flex-wrap": (ctx) => ctx.isFlex,
  // Multi-line flex containers (needs wrap) — or any grid container, where
  // align-content always applies (it distributes tracks along the block axis
  // whenever the grid is smaller than the container).
  "align-content": (ctx) =>
    (ctx.isFlex && ctx.flexWrap !== "nowrap") || ctx.isGrid,

  // Grid container — visible when this element computes display: grid.
  "grid-template-columns": (ctx) => ctx.isGrid,
  "grid-template-rows": (ctx) => ctx.isGrid,
  "justify-items": (ctx) => ctx.isGrid,

  // Flex child — visible when the parent is a flex container.
  // `align-self` also applies to grid items, so it shows for either parent.
  "align-self": (ctx) => ctx.parentIsFlex || ctx.parentIsGrid,
  order: (ctx) => ctx.parentIsFlex,
  flex: (ctx) => ctx.parentIsFlex,
  "flex-grow": (ctx) => ctx.parentIsFlex,
  "flex-shrink": (ctx) => ctx.parentIsFlex,
  "flex-basis": (ctx) => ctx.parentIsFlex,

  // Grid child — visible when the parent is a grid container.
  "grid-area": (ctx) => ctx.parentIsGrid,
  "justify-self": (ctx) => ctx.parentIsGrid,

  // Position offsets are only meaningful when position is non-static.
  top: (ctx) => ctx.position !== "static",
  right: (ctx) => ctx.position !== "static",
  bottom: (ctx) => ctx.position !== "static",
  left: (ctx) => ctx.position !== "static",
  "z-index": (ctx) => ctx.position !== "static",
}

export function isPropertyVisible(name: string, ctx: StyleContext): boolean {
  const fn = VISIBILITY[name]
  return fn ? fn(ctx) : true
}
