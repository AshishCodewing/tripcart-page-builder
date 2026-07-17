import type { Property, Sector } from "grapesjs"

import type { StyleContext } from "./use-style-context"
import { isPropertyVisible } from "./visibility"

// Native port of the search behaviour from @silexlabs/grapesjs-filter-styles.
// The upstream plugin injects an input into GrapesJS's default Style Manager
// DOM and toggles model `visible`/`open` flags; this project renders its own
// React Style Manager, so the same behaviour lives as a pure filter over the
// sector/property models instead.

type SelectOption = {
  id?: string
  label?: string
  name?: string
  value?: string
}

type WithSubProperties = { getProperties: () => Property[] }

// Composite/stack properties expose their sub-fields via `getProperties()`.
function hasSubProperties(
  property: Property
): property is Property & WithSubProperties {
  return (
    typeof (property as Partial<WithSubProperties>).getProperties === "function"
  )
}

function optionTexts(property: Property): string[] {
  const options = property.get("options") as SelectOption[] | undefined
  if (!Array.isArray(options)) return []
  return options.flatMap((o) =>
    [o.id, o.label, o.name, o.value].filter((v): v is string => Boolean(v))
  )
}

// The searchable text for a property: its label, CSS name, any select/radio
// option ids+labels, and the same fields for each composite/stack sub-field.
// Mirrors the `searchable` field built by grapesjs-filter-styles.
function propertySearchText(property: Property): string {
  const parts: string[] = [
    property.getLabel(),
    property.getName(),
    ...optionTexts(property),
  ]
  if (hasSubProperties(property)) {
    for (const sub of property.getProperties()) {
      parts.push(sub.getLabel(), sub.getName(), ...optionTexts(sub))
    }
  }
  return parts.filter(Boolean).join(" ").toLowerCase()
}

function propertyMatchesQuery(property: Property, query: string): boolean {
  return propertySearchText(property).includes(query)
}

/**
 * The properties a sector should render for the given context + search query.
 * Always constrained to context-visible properties (flex/grid/position gating).
 * With a query, a sector-name match reveals all of them; otherwise only the
 * properties whose searchable text contains the query survive. Shared by the
 * sector renderer and the Style Manager's empty-state check so the two can't
 * drift.
 */
export function filterSectorProperties(
  sector: Sector,
  ctx: StyleContext,
  query: string
): ReturnType<Sector["getProperties"]> {
  const visible = sector
    .getProperties()
    .filter((p) => isPropertyVisible(p.getName(), ctx))
  const q = query.trim().toLowerCase()
  if (!q) return visible
  if (sector.getName().toLowerCase().includes(q)) return visible
  return visible.filter((p) => propertyMatchesQuery(p, q))
}
