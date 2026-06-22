// Pure mutation helpers for the theme store. No module state here — every
// function takes its inputs and returns new values, so they're unit-testable
// in isolation.

import type { ActivePresetId } from "@/lib/tokens"
import type { PresetCategory } from "@/lib/theme/compile"
import type { Token } from "@/lib/theme/schema"
import type { Preset } from "@/lib/theme/presets"

// Remove a category's entry from the active-preset map, preserving the
// original reference when there's nothing to remove.
export const clearActiveFor = (
  active: ActivePresetId,
  category: PresetCategory
): ActivePresetId => {
  if (active[category] === undefined) return active
  const rest = { ...active }
  delete rest[category]
  return rest
}

// Merge a preset's tokens over the existing ones: override matching slugs in
// place (keeping order) and append any slugs the preset introduces.
export const mergePresetTokens = (
  existing: Token[],
  presetTokens: Preset["tokens"]
): Token[] => {
  const updates = new Map(presetTokens.map((t) => [t.slug, t]))
  const merged: Token[] = existing.map((t) => {
    const u = updates.get(t.slug)
    return u ? { ...t, ...u } : t
  })
  for (const t of presetTokens) {
    if (!merged.some((x) => x.slug === t.slug)) merged.push(t)
  }
  return merged
}
