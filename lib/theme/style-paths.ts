// Immutable path get/set over the theme document's `styles` half.
//
// `settings` tokens are edited through `token-paths.ts`, whose header states
// the convention this module generalises: rebuild ONLY the touched branch and
// share references for every untouched subtree, so `useThemeSelector` slices
// over unrelated parts of the theme don't re-fire. Preserve that when editing
// this file.
//
// Writing `undefined` deletes the leaf and prunes every object that becomes
// empty on the way back up — a theme should never accumulate
// `{ elements: { button: { color: {} } } }` after a user clears a field.

export type Path = readonly string[]

type Dict = Record<string, unknown>

const isDict = (value: unknown): value is Dict =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Structural equality for the plain JSON the theme document is made of. */
export const isEqualJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false
    }
    return a.every((item, i) => isEqualJson(item, b[i]))
  }
  if (!isDict(a) || !isDict(b)) return false
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => key in b && isEqualJson(a[key], b[key]))
}

export const getAtPath = (obj: unknown, path: Path): unknown => {
  let current: unknown = obj
  for (const key of path) {
    if (!isDict(current)) return undefined
    current = current[key]
  }
  return current
}

/**
 * Returns a copy of `obj` with `path` set to `value`, or the SAME `obj` when
 * nothing changed. Missing intermediates are created as `{}`. A `value` of
 * `undefined` removes the leaf; any ancestor left empty is removed too, and an
 * `obj` emptied all the way out returns `undefined` so its own parent can
 * prune it.
 */
export const setAtPath = <T extends Dict>(
  obj: T,
  path: Path,
  value: unknown
): T | undefined => {
  if (path.length === 0) return obj
  // Clearing something that isn't there is a no-op. Without this guard the
  // walk below would create the missing intermediates on its way down and
  // leave empty objects behind.
  if (value === undefined && getAtPath(obj, path) === undefined) return obj

  const [key, ...rest] = path
  const current = obj[key]

  let next: unknown
  if (rest.length === 0) {
    next = value
  } else {
    const child = isDict(current) ? current : {}
    next = setAtPath(child, rest, value)
  }

  if (next === current) return obj
  if (next === undefined && !(key in obj)) return obj

  const copy: Dict = { ...obj }
  if (next === undefined) delete copy[key]
  else copy[key] = next

  return Object.keys(copy).length === 0 ? undefined : (copy as T)
}
