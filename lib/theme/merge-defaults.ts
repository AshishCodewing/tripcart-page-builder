/**
 * Layers a tenant's stored theme over the bundled `defaultTheme`, the way
 * WordPress layers a theme's theme.json over core's: the stored document
 * is a set of overrides, and anything it does not mention comes from the
 * defaults. This is what lets a new default (an element style, a
 * `variations` entry, a preset) reach tenants who saved their theme before
 * the default existed.
 *
 * Merge rules:
 *   - plain objects recurse, stored keys win;
 *   - arrays (token lists such as `settings.color.palette`) are replaced
 *     wholesale by the stored array — a tenant that removed a token must
 *     not get it back;
 *   - primitives from the stored document win.
 *
 * Consequence: a tenant cannot *delete* a default key, only override its
 * value. Deleting from `defaultTheme` is the only way to remove a default.
 */

import { defaultTheme } from "@/lib/tokens"
import type { Theme } from "@/lib/theme/schema"

type PlainObject = Record<string, unknown>

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype

const mergeDeep = (base: PlainObject, over: PlainObject): PlainObject => {
  const out: PlainObject = { ...base }
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue
    const current = out[key]
    out[key] =
      isPlainObject(current) && isPlainObject(value)
        ? mergeDeep(current, value)
        : value
  }
  return out
}

export const mergeThemeOverDefaults = (
  stored: Theme,
  base: Theme = defaultTheme
): Theme =>
  mergeDeep(
    structuredClone(base) as unknown as PlainObject,
    stored as unknown as PlainObject
  ) as unknown as Theme
