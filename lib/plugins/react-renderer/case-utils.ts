// camelCase ↔ kebab-case conversion for style keys.

export const camelToKebab = (input: string): string =>
  input.replace(
    /[A-Z]+(?![a-z])|[A-Z]/g,
    (match, offset) => (offset ? "-" : "") + match.toLowerCase()
  )

export const kebabToCamel = (input: string): string =>
  input.includes("-")
    ? input.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    : input

// React style obj (camelCase keys) → GrapesJS style obj (kebab-case keys).
// Only string/number values are kept; everything else is dropped.
export const camelKeysToKebabStyle = (
  styles: Record<string, string | number>
): Record<string, string | number> => {
  const out: Record<string, string | number> = {}
  for (const key in styles) {
    if (Object.prototype.hasOwnProperty.call(styles, key)) {
      out[camelToKebab(key)] = styles[key]
    }
  }
  return out
}
