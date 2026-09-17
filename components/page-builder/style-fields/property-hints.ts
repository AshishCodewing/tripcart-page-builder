import type { Property } from "grapesjs"

/**
 * Rendering hints a Style Manager property declaration can carry. GrapesJS keeps
 * unknown declaration keys as plain attributes on the property model; these are
 * read only by our React panel.
 *
 * - `advanced` — the row renders inside its sector's "Advanced" fold.
 */
export type PropertyHint = "advanced"

export const hasHint = (property: Property, hint: PropertyHint): boolean =>
  !!(property.attributes as Record<string, unknown>)[hint]
