"use client"

import * as React from "react"
import { useEditor } from "@grapesjs/react"

// Snapshot of the selected element's computed style + its parent's, used by
// the Style Manager to gate Layout properties (flex-container vs flex-child).
// Mirrors what `Mq` reads in the Studio SDK (see column-block-and-style-manager.md).
export type StyleContext = {
  isFlex: boolean
  parentIsFlex: boolean
  flexDirection: string
  // Parent's computed flex-direction. Used by flex-child fields (align-self)
  // to rotate their axis-icons in the same way the container's own
  // justify-content / align-items do.
  parentFlexDirection: string
  flexWrap: string
  position: string
}

const DEFAULT_CONTEXT: StyleContext = {
  isFlex: false,
  parentIsFlex: false,
  flexDirection: "row",
  parentFlexDirection: "row",
  flexWrap: "nowrap",
  position: "static",
}

const StyleContextCtx = React.createContext<StyleContext>(DEFAULT_CONTEXT)

export function useStyleContext(): StyleContext {
  return React.useContext(StyleContextCtx)
}

export function StyleContextProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const editor = useEditor()
  const [ctx, setCtx] = React.useState<StyleContext>(DEFAULT_CONTEXT)

  React.useEffect(() => {
    let frame: number | null = null
    const compute = () => {
      // Defer one frame so style writes that triggered the event have actually
      // landed in the iframe's CSSOM before getComputedStyle reads them.
      if (frame != null) return
      frame = requestAnimationFrame(() => {
        frame = null
        const sel = editor.getSelected()
        const el = sel?.getEl()
        if (!el) {
          setCtx(DEFAULT_CONTEXT)
          return
        }
        const win = el.ownerDocument?.defaultView
        if (!win) return
        const cs = win.getComputedStyle(el)
        const parent = el.parentElement
        const ps = parent ? win.getComputedStyle(parent) : null
        const display = cs.display || ""
        const parentDisplay = ps?.display || ""
        setCtx({
          isFlex: display.includes("flex"),
          parentIsFlex: parentDisplay.includes("flex"),
          flexDirection: cs.flexDirection || "row",
          parentFlexDirection: ps?.flexDirection || "row",
          flexWrap: cs.flexWrap || "nowrap",
          position: cs.position || "static",
        })
      })
    }

    compute()
    const events = [
      "component:selected",
      "component:deselected",
      "component:update:style",
      "style:property:update",
      "style:target",
      "frame:load",
    ]
    for (const ev of events) editor.on(ev, compute)
    return () => {
      for (const ev of events) editor.off(ev, compute)
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [editor])

  return (
    <StyleContextCtx.Provider value={ctx}>{children}</StyleContextCtx.Provider>
  )
}
