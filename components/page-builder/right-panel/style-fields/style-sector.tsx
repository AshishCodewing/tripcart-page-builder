"use client"

import * as React from "react"
import type { Sector } from "grapesjs"
import { ChevronDown } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import PropertyField from "./property-field"
import { useStyleContext } from "./use-style-context"
import { isPropertyVisible } from "./visibility"

export default function StyleSector({ sector }: { sector: Sector }) {
  const [open, setOpen] = React.useState<boolean>(() => sector.isOpen())
  const ctx = useStyleContext()
  const properties = sector
    .getProperties()
    .filter((p) => isPropertyVisible(p.getName(), ctx))

  // If every property in the sector was filtered out, hide the sector entirely
  // — an empty collapsible reads as a bug.
  if (properties.length === 0) return null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    sector.setOpen(next)
  }

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger
        render={
          <button
            type="button"
            className="group/sector flex w-full items-center justify-between rounded-md px-2 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 motion-reduce:transition-none"
          />
        }
      >
        <span>{sector.getName()}</span>
        <ChevronDown
          className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-panel-open/sector:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2 px-2 pb-3 pt-1">
          {properties.map((p) => (
            <PropertyField key={p.getId()} property={p} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
