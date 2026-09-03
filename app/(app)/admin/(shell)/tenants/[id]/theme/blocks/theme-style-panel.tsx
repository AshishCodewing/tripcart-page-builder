"use client"

import * as React from "react"
import { StylesProvider } from "@grapesjs/react"
import type { Sector } from "grapesjs"

import { SECTOR_GROUPS } from "@/components/page-builder/editor-config/theme-style-sectors"
import StyleSector from "@/components/page-builder/style-fields/style-sector"
import { StyleContextProvider } from "@/components/page-builder/style-fields/use-style-context"
import { supportsFor, type StyleTarget } from "@/lib/theme/style-targets"

/**
 * The page editor's own style controls, pointed at a theme rule.
 *
 * Sectors, properties, colour pickers, unit inputs, the clear affordance — all
 * of it is the editor's `StyleSector` and the fields below it, unchanged. We
 * render our own shell only to drop the editor panel's "Select a component"
 * empty state (there is never a selected component here) and to honour a
 * part's `supports`, should one ever narrow its style groups.
 */
// Nothing is ever selected in the style book (the panel edits a rule, not a
// component), so the layout context would be the static default and every
// flex-gated row — `gap`, the alignment properties, the child properties —
// would be filtered out. Themeable parts are flex containers (the tab bar) and
// flex children (the tab button in it), so declare both. `flexWrap` is set too
// because `align-content` is gated on a wrapping container, which a theme may
// well set.
const STYLE_CONTEXT = { isFlex: true, parentIsFlex: true, flexWrap: "wrap" }

export default function ThemeStylePanel({ target }: { target: StyleTarget }) {
  // Single-open accordion, same as the editor panel. Typography (which holds
  // text colour) opens first because it is what people come here to change.
  const [openId, setOpenId] = React.useState<string | null>("typography")
  const allowed = new Set<string>(supportsFor(target))
  // A sector stays if any group it stores into is allowed on this part.
  const sectorAllowed = (id: string): boolean =>
    (SECTOR_GROUPS[id] ?? []).some((group) => allowed.has(group))

  if (allowed.size === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        This block has no registered style surface yet, so there is nothing to
        edit here.
      </p>
    )
  }

  return (
    <StyleContextProvider override={STYLE_CONTEXT}>
      <StylesProvider>
        {({ sectors }: { sectors: Sector[] }) => (
          <div className="flex flex-col border-t">
            {sectors
              .filter((sector) => sectorAllowed(sector.getId()))
              .map((sector) => (
                <StyleSector
                  key={sector.getId()}
                  sector={sector}
                  openId={openId}
                  onOpenChange={setOpenId}
                />
              ))}
          </div>
        )}
      </StylesProvider>
    </StyleContextProvider>
  )
}
