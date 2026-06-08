"use client"

import * as React from "react"
import { TraitsProvider } from "@grapesjs/react"
import type { Trait } from "grapesjs"
import { ChevronDown } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

import TraitField from "../trait-fields/trait-field"

// ---------------------------------------------------------------------------
// Category grouping
// ---------------------------------------------------------------------------

type CategoryGroup = { id: string; label: string; traits: Trait[] }

function groupByCategory(traits: Trait[]): {
  uncategorized: Trait[]
  categories: CategoryGroup[]
} {
  const map = new Map<string, CategoryGroup>()
  const uncategorized: Trait[] = []

  for (const trait of traits) {
    const raw = trait.get("category") as
      | string
      | { id: string; label?: string }
      | undefined

    if (!raw) {
      uncategorized.push(trait)
      continue
    }

    const id = typeof raw === "string" ? raw : raw.id
    const label = typeof raw === "string" ? raw : (raw.label ?? raw.id)

    if (!map.has(id)) map.set(id, { id, label, traits: [] })
    map.get(id)!.traits.push(trait)
  }

  return { uncategorized, categories: Array.from(map.values()) }
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export default function TraitManager() {
  return (
    <TraitsProvider>
      {({ traits }) => {
        if (traits.length === 0) {
          return (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              Select a component to edit settings.
            </p>
          )
        }
        // Keying on the component CID resets openId whenever selection changes.
        const componentKey =
          (traits[0] as { target?: { cid?: string } }).target?.cid ?? "none"
        return <TraitManagerInner key={componentKey} traits={traits} />
      }}
    </TraitsProvider>
  )
}

// ---------------------------------------------------------------------------
// Inner — groups traits, owns openId accordion state
// ---------------------------------------------------------------------------

function TraitManagerInner({ traits }: { traits: Trait[] }) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const { uncategorized, categories } = groupByCategory(traits)

  return (
    <div className="flex flex-col">
      {uncategorized.length > 0 && (
        <div className="flex flex-col gap-4">
          {uncategorized.map((t) => (
            <TraitField key={t.getId()} trait={t} />
          ))}
        </div>
      )}
      {categories.map((group) => (
        <TraitCategory
          key={group.id}
          group={group}
          openId={openId}
          onOpenChange={setOpenId}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// TraitCategory — collapsible section, mirrors StyleSector
// ---------------------------------------------------------------------------

function TraitCategory({
  group,
  openId,
  onOpenChange,
}: {
  group: CategoryGroup
  openId: string | null
  onOpenChange: (id: string | null) => void
}) {
  const open = openId === group.id

  return (
    <>
      <Collapsible
        open={open}
        onOpenChange={(next) => onOpenChange(next ? group.id : null)}
      >
        <CollapsibleTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="group/category flex h-auto w-full items-center justify-between rounded-none border-none px-2 py-2 text-xs font-medium text-foreground hover:bg-muted/50 motion-reduce:transition-none"
            />
          }
        >
          <span>{group.label}</span>
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform duration-150 group-data-panel-open/category:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="flex flex-col divide-y divide-border px-2">
            {group.traits.map((t) => (
              <TraitField key={t.getId()} trait={t} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
      <hr />
    </>
  )
}
