"use client"

import * as React from "react"
import { StylesProvider, useEditor } from "@grapesjs/react"
import type { Sector } from "grapesjs"

import StyleSector from "../style-fields/style-sector"
import { StyleContextProvider } from "../style-fields/use-style-context"

export default function StyleManager() {
  return (
    <StyleContextProvider>
      <StylesProvider>
        {({ sectors }) => <StyleManagerInner sectors={sectors} />}
      </StylesProvider>
    </StyleContextProvider>
  )
}

function StyleManagerInner({ sectors }: { sectors: Sector[] }) {
  const editor = useEditor()
  const [hasTarget, setHasTarget] = React.useState<boolean>(
    () => editor.StyleManager.getSelected() != null
  )

  // The provider re-renders on `style:custom`, but that fires only when the
  // styles container itself changes — selecting/deselecting a component is
  // a separate event. Track target presence here so the placeholder vs. the
  // sectors render decision stays in sync with the canvas selection.
  React.useEffect(() => {
    const refresh = () =>
      setHasTarget(editor.StyleManager.getSelected() != null)
    editor.on("style:target", refresh)
    editor.on("component:selected", refresh)
    editor.on("component:deselected", refresh)
    return () => {
      editor.off("style:target", refresh)
      editor.off("component:selected", refresh)
      editor.off("component:deselected", refresh)
    }
  }, [editor])

  if (!hasTarget) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        Select a component to edit styles.
      </p>
    )
  }

  return (
    <div className="flex flex-col border-t">
      {sectors.map((sector) => (
        <StyleSector key={sector.getId()} sector={sector} />
      ))}
    </div>
  )
}
