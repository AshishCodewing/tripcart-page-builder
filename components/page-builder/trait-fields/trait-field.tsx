"use client"

import * as React from "react"
import type { Trait } from "grapesjs"

import ButtonTraitField from "./button-trait-field"
import CheckboxTraitField from "./checkbox-trait-field"
import ColorTraitField from "./color-trait-field"
import NumberTraitField from "./number-trait-field"
import SelectTraitField from "./select-trait-field"
import TextTraitField from "./text-trait-field"

export default function TraitField({ trait }: { trait: Trait }) {
  const type = trait.getType()

  if (type === "button") {
    return <ButtonTraitField trait={trait} />
  }

  let field: React.ReactNode
  switch (type) {
    case "number":
      field = <NumberTraitField trait={trait} />
      break
    case "select":
      field = <SelectTraitField trait={trait} />
      break
    case "checkbox":
      field = <CheckboxTraitField trait={trait} />
      break
    case "color":
      field = <ColorTraitField trait={trait} />
      break
    default:
      field = <TextTraitField trait={trait} />
  }

  return <TraitRow trait={trait}>{field}</TraitRow>
}

function TraitRow({
  trait,
  children,
}: {
  trait: Trait
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="truncate text-xs text-muted-foreground capitalize">
        {trait.getLabel()}
      </span>
      <div className="w-full">
        {children}
      </div>
    </div>
  )
}
