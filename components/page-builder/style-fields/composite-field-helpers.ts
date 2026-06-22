// Pure helpers for the composite style-field sub-components. No React — just
// PropertyComposite lookups, so they're unit-testable in isolation.

import type { Property, PropertyComposite, PropertySelect } from "grapesjs"

// Find a composite's sub-property by exact name.
export const findSub = (
  property: PropertyComposite,
  name: string
): Property | undefined =>
  property.getProperties().find((s) => s.getName() === name)

// Find a composite's sub-property by its side suffix, e.g. margin → "margin-top".
export const findSubBySide = (
  property: PropertyComposite,
  side: string
): Property | undefined => findSub(property, `${property.getName()}-${side}`)

// Extract { id, label } option pairs from a select sub-property (drives the
// "apply to all" select control on the overflow composite).
export const extractSelectOptions = (
  first: PropertySelect | undefined
): { id: string; label?: string }[] =>
  first?.getOptions
    ? first.getOptions().map((o) => ({
        id: first.getOptionId(o),
        label: first.getOptionLabel(o),
      }))
    : []
