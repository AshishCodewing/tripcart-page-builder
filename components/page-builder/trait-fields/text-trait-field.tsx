"use client"

import * as React from "react"
import type { Trait } from "grapesjs"

import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group"

export default function TextTraitField({ trait }: { trait: Trait }) {
  const externalValue = String(trait.getValue() ?? "")
  const [draft, setDraft] = React.useState(externalValue)

  const commit = () => trait.setValue(draft.trim())

  return (
    <InputGroup className="h-8">
      <InputGroupInput
        type="text"
        inputSize="sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          else if (e.key === "Escape") {
            setDraft(externalValue)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder={String(
          trait.getDefault() ??
            (trait.attributes as Record<string, unknown>).placeholder ??
            ""
        )}
        className="text-xs"
        spellCheck={false}
        autoComplete="off"
      />
    </InputGroup>
  )
}
