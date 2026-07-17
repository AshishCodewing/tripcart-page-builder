"use client"

import * as React from "react"
import { StylesProvider, useEditor } from "@grapesjs/react"
import type { Component, Sector } from "grapesjs"
import { Boxes, Filter, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  TEMPLATE_REF_SLUG_ATTR,
  TEMPLATE_REF_TYPE,
} from "@/lib/plugins/template-ref"
import StyleSector from "../style-fields/style-sector"
import { filterSectorProperties } from "../style-fields/style-search"
import {
  StyleContextProvider,
  useStyleContext,
} from "../style-fields/use-style-context"

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
  // The currently selected component, tracked so we can read its model flags
  // (`stylable`, `type`) to decide what to render in place of the sectors.
  const [selected, setSelected] = React.useState<Component | null>(
    () => editor.getSelected() ?? null
  )
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  // "Show modified only" — narrows the panel to properties set on the target.
  const [modifiedOnly, setModifiedOnly] = React.useState(false)
  const ctx = useStyleContext()

  // The provider re-renders on `style:custom`, but that fires only when the
  // styles container itself changes — selecting/deselecting a component is
  // a separate event. Track target presence here so the placeholder vs. the
  // sectors render decision stays in sync with the canvas selection.
  React.useEffect(() => {
    const refresh = () => {
      setHasTarget(editor.StyleManager.getSelected() != null)
      setSelected(editor.getSelected() ?? null)
      setOpenId(null)
      // Reset the filters when the target changes, mirroring grapesjs-filter-styles
      // (which clears its filter on component:selected).
      setQuery("")
      setModifiedOnly(false)
    }
    editor.on("style:target", refresh)
    editor.on("component:selected", refresh)
    editor.on("component:deselected", refresh)
    return () => {
      editor.off("style:target", refresh)
      editor.off("component:selected", refresh)
      editor.off("component:deselected", refresh)
    }
  }, [editor])

  // `stylable: false` (the GrapesJS component flag) is the single source of
  // truth for "this component can't be styled here" — keying off it instead
  // of the component type means the UI can't drift from the model. An array
  // value (a property whitelist) still counts as stylable. A `template-ref`
  // sets `stylable: false`, so it falls into this branch and gets its own
  // "edit original" panel; any other unstylable component gets a generic note.
  const isUnstylable = selected != null && selected.get("stylable") === false

  if (isUnstylable) {
    if (selected.get("type") === TEMPLATE_REF_TYPE) {
      const slug = String(
        selected.getAttributes()[TEMPLATE_REF_SLUG_ATTR] ?? ""
      )
      const title = String(selected.get("name") ?? "Template")
      return (
        <div className="flex flex-col gap-3 border-t px-3 py-4">
          <div className="flex items-center gap-2">
            <Boxes className="size-5 shrink-0 text-primary" />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Reuse this design across your site.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => editor.runCommand("tc:edit-template-ref", { slug })}
          >
            Edit original
          </Button>
        </div>
      )
    }
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        This element can&apos;t be styled.
      </p>
    )
  }

  if (!hasTarget) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        Select a component to edit styles.
      </p>
    )
  }

  const searching = query.trim().length > 0
  const filtering = searching || modifiedOnly
  const hasMatches = sectors.some(
    (sector) =>
      filterSectorProperties(sector, ctx, query, modifiedOnly).length > 0
  )

  return (
    <div className="flex flex-col border-t">
      <div className="border-b p-2">
        <InputGroup className="h-8">
          <InputGroupAddon>
            <Search className="size-3.5" />
          </InputGroupAddon>
          <InputGroupInput
            inputSize="sm"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles…"
            aria-label="Search styles"
            className="text-xs [&::-webkit-search-cancel-button]:appearance-none"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              aria-pressed={modifiedOnly}
              aria-label="Show only modified styles"
              title="Show only modified styles"
              onClick={() => setModifiedOnly((v) => !v)}
              className={
                modifiedOnly
                  ? "bg-accent text-primary"
                  : "text-muted-foreground"
              }
            >
              <Filter />
            </InputGroupButton>
            {searching && (
              <InputGroupButton
                size="icon-xs"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X />
              </InputGroupButton>
            )}
          </InputGroupAddon>
        </InputGroup>
      </div>
      {filtering && !hasMatches ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">
          {searching
            ? `No styles match “${query.trim()}”.`
            : "No styles set on this element."}
        </p>
      ) : (
        sectors.map((sector) => (
          <StyleSector
            key={sector.getId()}
            sector={sector}
            openId={openId}
            onOpenChange={setOpenId}
            query={query}
            modifiedOnly={modifiedOnly}
          />
        ))
      )}
    </div>
  )
}
