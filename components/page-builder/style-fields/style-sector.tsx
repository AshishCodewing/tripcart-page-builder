"use client"

import type { PropertyNumber, Sector } from "grapesjs"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import { CrossGrid, type Side } from "./box-sides-field"
import PropertyField from "./property-field"
import { useStyleContext } from "./use-style-context"
import { isPropertyVisible } from "./visibility"

export default function StyleSector({
  sector,
  openId,
  onOpenChange,
}: {
  sector: Sector
  openId: string | null
  onOpenChange: (id: string | null) => void
}) {
  const open = openId === sector.getId()
  const ctx = useStyleContext()
  const properties = sector
    .getProperties()
    .filter((p) => isPropertyVisible(p.getName(), ctx))

  // If every property in the sector was filtered out, hide the sector entirely
  // — an empty collapsible reads as a bug.
  if (properties.length === 0) return null

  const hasSetValue = properties.some((p) => p.hasValue({ noParent: true }))
  const inherited = properties.some((p) => p.hasValueParent())

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next ? sector.getId() : null)
    sector.setOpen(next)
  }

  return (
    <>
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="group/sector flex h-auto w-full items-center border-none justify-between rounded-none px-2 py-2 text-xs font-medium text-foreground hover:bg-muted/50 motion-reduce:transition-none"
          />
        }
      >
        <div className="flex items-center gap-3">
          <span>{sector.getName()}</span>
          <div className="flex items-center gap-1">
            {hasSetValue && (
              <span className="size-1.5 block shrink-0 rounded-full bg-primary" />
            )}
            {inherited && <span className="size-1.5 block shrink-0 rounded-full bg-warning"/>}
          </div>
        </div>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-panel-open/sector:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 p-2">
          {sector.getId() === "position" ? (
            <PositionSectorBody properties={properties} />
          ) : (
            properties.map((p) => (
              <PropertyField key={p.getId()} property={p} />
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
    <hr />
    </>
  )
}

// Position sector renders the `position` property as a normal row, then puts
// the four edge offsets (top/right/bottom/left) into the same cross layout
// used by margin/padding's custom mode. Empty offsets stay hidden, so a
// component that only sets `position: relative` doesn't show a redundant grid.
const POSITION_SIDES: Side[] = ["top", "right", "bottom", "left"]

function PositionSectorBody({
  properties,
}: {
  properties: ReturnType<Sector["getProperties"]>
}) {
  const sideMap = new Map<Side, PropertyNumber>()
  for (const p of properties) {
    const name = p.getName() as Side
    if (POSITION_SIDES.includes(name)) {
      sideMap.set(name, p as PropertyNumber)
    }
  }
  const others = properties.filter(
    (p) => !POSITION_SIDES.includes(p.getName() as Side)
  )
  const bySide = (side: Side) => sideMap.get(side)
  const hasSides = sideMap.size > 0

  return (
    <>
      {others.map((p) => (
        <PropertyField key={p.getId()} property={p} />
      ))}
      {hasSides ? (
        <div className="rounded-md border border-border/60 bg-muted/30 p-2">
          <CrossGrid bySide={bySide} />
        </div>
      ) : null}
    </>
  )
}
