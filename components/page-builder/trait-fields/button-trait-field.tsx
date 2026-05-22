"use client"

import type { Trait } from "grapesjs"

import { Button } from "@/components/ui/button"

export default function ButtonTraitField({ trait }: { trait: Trait }) {
  return (
    <div className="w-full py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full text-xs"
        onClick={() => trait.runCommand()}
      >
        {trait.getLabel()}
      </Button>
    </div>
  )
}
