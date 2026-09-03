"use client"

import * as React from "react"
import type { Editor } from "grapesjs"

import {
  findSpecimen,
  getStyleBookEntry,
  specimenIdFor,
} from "@/lib/theme/style-book"
import type { ElementPseudoKey, StyleTarget } from "@/lib/theme/style-targets"

import BlockDetail from "./block-detail"
import BlockList from "./block-list"
import StyleBookEditor from "./style-book-editor"
import { useSpecimenSelection } from "./use-specimen-selection"
import { useThemeStyleSync } from "./use-theme-style-sync"

type PanelState = {
  query: string
  /** null = the list; otherwise the selected style-book entry. */
  entryId: string | null
  /** Element entries: which variation is being edited (null = the base look). */
  variation: string | null
  /** Component entries: which part (null = the root block). */
  part: string | null
  /** Selector suffix (":hover", '[aria-selected="true"]'), null = base. */
  state: string | null
}

const INITIAL: PanelState = {
  query: "",
  entryId: null,
  variation: null,
  part: null,
  state: null,
}

/**
 * Theme → Blocks. Left pane lists the themeable blocks and, once one is
 * chosen, the editor's own style controls pointed at that block's theme rule;
 * right pane is the style book canvas.
 *
 * Selection lives in local state rather than the URL: the draft itself is held
 * in `themeStore` and doesn't survive a reload, so a deep link to "Button,
 * Outline, hover" would restore a panel pointing at values the user never saved.
 */
export default function BlocksScreen() {
  const [panel, setPanel] = React.useState<PanelState>(INITIAL)
  const [editor, setEditor] = React.useState<Editor | null>(null)

  const entry = getStyleBookEntry(panel.entryId)

  const target = React.useMemo<StyleTarget | null>(() => {
    if (!entry) return null
    if (entry.kind === "element") {
      return {
        kind: "element",
        name: entry.name,
        ...(panel.variation ? { variation: panel.variation } : {}),
        ...(panel.state ? { state: panel.state as ElementPseudoKey } : {}),
      }
    }
    return {
      kind: "component",
      type: entry.type,
      ...(panel.part ? { part: panel.part } : {}),
      ...(panel.state ? { state: panel.state } : {}),
    }
  }, [entry, panel.variation, panel.part, panel.state])

  const highlight = entry
    ? (specimenIdFor(entry, panel.variation) ?? null)
    : null

  const selectSpecimen = React.useCallback((specimenId: string): void => {
    const found = findSpecimen(specimenId)
    if (!found) return
    setPanel((prev) => ({
      ...prev,
      entryId: found.entry.id,
      variation: found.specimen.variation ?? null,
      part: null,
      state: null,
    }))
  }, [])

  useThemeStyleSync(editor, target)
  useSpecimenSelection(editor, highlight, selectSpecimen)

  return (
    <StyleBookEditor onEditor={setEditor}>
      {entry && target ? (
        <BlockDetail
          entry={entry}
          target={target}
          variation={panel.variation}
          part={panel.part}
          state={panel.state}
          onBack={() => setPanel((prev) => ({ ...prev, entryId: null }))}
          onVariationChange={(variation) =>
            setPanel((prev) => ({ ...prev, variation, state: null }))
          }
          onPartChange={(part) =>
            setPanel((prev) => ({ ...prev, part, state: null }))
          }
          onStateChange={(state) => setPanel((prev) => ({ ...prev, state }))}
        />
      ) : (
        <BlockList
          query={panel.query}
          onQueryChange={(query) => setPanel((prev) => ({ ...prev, query }))}
          onSelect={(entryId) =>
            setPanel((prev) => ({
              ...prev,
              entryId,
              variation: null,
              part: null,
              state: null,
            }))
          }
        />
      )}
    </StyleBookEditor>
  )
}
