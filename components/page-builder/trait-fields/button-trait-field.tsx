"use client"

import type { Trait } from "grapesjs"

import { Button } from "@/components/ui/button"

export default function ButtonTraitField({ trait }: { trait: Trait }) {
  // A button trait's caption is its `text` (GrapesJS convention); getLabel()
  // falls back to the trait *name* when `label: false`, which would show
  // "add-tab" instead of "+ Add tab".
  const text = (trait.get("text") as string | undefined) || trait.getLabel()
  return (
    <div className="w-full py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => trait.runCommand()}
      >
        {text}
      </Button>
    </div>
  )
}
