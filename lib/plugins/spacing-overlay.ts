/**
 * Draws a DevTools-style spacing overlay on the canvas: green boxes for a
 * component's padding, orange boxes for its margin, on hover and on the
 * selected component.
 *
 * Why this exists instead of GrapesJS's built-in offset viewer
 * (`showOffsets` / `showOffsetsSelected`): in this editor's `@grapesjs/react`
 * iframe setup the built-in `show-offset` command only ever sizes the
 * full-width top/bottom strips — the left/right boxes never get dimensions —
 * and its defaults (navy/yellow at 0.1 opacity) are effectively invisible. So
 * we render our own overlay from the real computed spacing.
 *
 * Mechanism (all documented Canvas APIs):
 *   - A custom canvas spot per interaction (`SPOT_HOVER` / `SPOT_SELECT`) is
 *     attached to the component via `Canvas.addSpot({ type, component })`.
 *     Custom-typed spots render no built-in visual but ARE repositioned by the
 *     spot system on scroll/zoom/resize.
 *   - `spot.getBoxRect()` gives the component's border box in screen (zoomed)
 *     coordinates within the spots container (`Canvas.getSpotsEl()`); we mount
 *     our boxes there.
 *   - We re-render on `canvas:spot` (fired by `refreshSpots()` on every canvas
 *     update the SelectComponent command drives) so the overlay stays glued to
 *     the component.
 */

import type { CanvasSpot, Component, Editor } from "grapesjs"

const SPOT_HOVER = "tc-spacing-hover"
const SPOT_SELECT = "tc-spacing-select"

// Chrome DevTools box-model colors.
const PADDING_COLOR = "rgb(147, 196, 125)" // green
const MARGIN_COLOR = "rgb(246, 178, 107)" // orange
const OPACITY_HOVER = "0.55"
const OPACITY_SELECT = "0.7"

type Box = Partial<CSSStyleDeclaration>

const el = (styles: Box): HTMLDivElement => {
  const d = document.createElement("div")
  d.style.position = "absolute"
  d.style.pointerEvents = "none"
  Object.assign(d.style, styles)
  return d
}

export const spacingOverlayPlugin = (editor: Editor) => {
  const canvas: Editor["Canvas"] = editor.Canvas
  let overlay: HTMLElement | null = null

  const getOverlay = (): HTMLElement | null => {
    if (overlay?.isConnected) return overlay
    const spotsEl = canvas.getSpotsEl()
    if (!spotsEl) return null
    overlay = document.createElement("div")
    overlay.className = "tc-spacing-overlay"
    overlay.style.pointerEvents = "none"
    spotsEl.appendChild(overlay)
    return overlay
  }

  const renderSpot = (spot: CanvasSpot, into: HTMLElement) => {
    const cmp = spot.component
    const cel = cmp?.getEl()
    if (!cel) return
    const view = cel.ownerDocument.defaultView
    if (!view) return

    const { width: W, height: H, x, y } = spot.getBoxRect()
    if (!W || !H) return

    const zoom = canvas.getZoomDecimal()
    const cs = view.getComputedStyle(cel)
    const px = (v: string) => Math.max(0, (parseFloat(v) || 0) * zoom)
    const pt = px(cs.paddingTop)
    const pb = px(cs.paddingBottom)
    const pl = px(cs.paddingLeft)
    const pr = px(cs.paddingRight)
    const mt = px(cs.marginTop)
    const mb = px(cs.marginBottom)
    const ml = px(cs.marginLeft)
    const mr = px(cs.marginRight)

    const emphasized = spot.isType(SPOT_SELECT)
    const opacity = emphasized ? OPACITY_SELECT : OPACITY_HOVER

    // Border box, positioned exactly like a built-in spot.
    const wrap = el({
      top: "0",
      left: "0",
      width: `${W}px`,
      height: `${H}px`,
      translate: `${x}px ${y}px`,
    })

    const pad = (s: Box) =>
      wrap.appendChild(el({ background: PADDING_COLOR, opacity, ...s }))
    const mar = (s: Box) =>
      wrap.appendChild(el({ background: MARGIN_COLOR, opacity, ...s }))

    // Padding — inset from the border box.
    if (pt) pad({ top: "0", left: "0", width: `${W}px`, height: `${pt}px` })
    if (pb) pad({ bottom: "0", left: "0", width: `${W}px`, height: `${pb}px` })
    if (pl)
      pad({
        top: `${pt}px`,
        left: "0",
        width: `${pl}px`,
        height: `${H - pt - pb}px`,
      })
    if (pr)
      pad({
        top: `${pt}px`,
        right: "0",
        width: `${pr}px`,
        height: `${H - pt - pb}px`,
      })

    // Margin — outset beyond the border box.
    if (mt)
      mar({ top: `${-mt}px`, left: "0", width: `${W}px`, height: `${mt}px` })
    if (mb)
      mar({ bottom: `${-mb}px`, left: "0", width: `${W}px`, height: `${mb}px` })
    if (ml)
      mar({
        top: `${-mt}px`,
        left: `${-ml}px`,
        width: `${ml}px`,
        height: `${H + mt + mb}px`,
      })
    if (mr)
      mar({
        top: `${-mt}px`,
        right: `${-mr}px`,
        width: `${mr}px`,
        height: `${H + mt + mb}px`,
      })

    into.appendChild(wrap)
  }

  const render = () => {
    const into = getOverlay()
    if (!into) return
    into.replaceChildren()
    // Selected first, then hover on top.
    const spots = [
      ...canvas.getSpots({ type: SPOT_SELECT }),
      ...canvas.getSpots({ type: SPOT_HOVER }),
    ]
    for (const spot of spots) renderSpot(spot, into)
  }

  const setSpot = (type: string, component?: Component) => {
    canvas.removeSpots({ type })
    if (component) canvas.addSpot({ type, component })
  }

  editor.on("component:hovered", (cmp: Component) => {
    // Skip if it's already the selected component (its select overlay shows).
    setSpot(SPOT_HOVER, cmp && cmp !== editor.getSelected() ? cmp : undefined)
  })
  editor.on("component:unhovered", () => setSpot(SPOT_HOVER))
  editor.on("component:selected", (cmp: Component) => setSpot(SPOT_SELECT, cmp))
  editor.on("component:deselected", () => setSpot(SPOT_SELECT))

  // `canvas:spot` (debounced) fires on scroll / zoom / resize / DOM updates and
  // keeps the overlay aligned; `:add` / `:remove` fire immediately so hover and
  // selection changes render without the debounce lag. Also re-render on live
  // style edits (padding/margin changed in the Style Manager).
  editor.on("canvas:spot canvas:spot:add canvas:spot:remove", render)
  editor.on("component:styleUpdate", render)
}

export default spacingOverlayPlugin
