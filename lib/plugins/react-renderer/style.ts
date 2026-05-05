// camelCase ↔ kebab-case conversion + normalization for the polymorphic style
// values that GrapesJS surfaces (object, "a:b;c:d" string, [{name,value}] array,
// or even a JSON-encoded object string from a stored attribute).

import type { CSSProperties } from "react"

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

const kebabKeysToCamelStyle = (
  styles: Record<string, unknown>
): CSSProperties | undefined => {
  const out: Record<string, string | number> = {}
  let any = false
  for (const key in styles) {
    if (!Object.prototype.hasOwnProperty.call(styles, key)) continue
    const value = styles[key]
    if (typeof value === "string" || typeof value === "number") {
      out[kebabToCamel(key)] = value
      any = true
    }
  }
  return any ? (out as CSSProperties) : undefined
}

const parseStyleString = (str: string): CSSProperties | undefined => {
  const out: Record<string, string> = {}
  for (const decl of str.split(";")) {
    if (!decl.trim()) continue
    const colon = decl.indexOf(":")
    if (colon <= 0) continue
    const name = decl.slice(0, colon).trim()
    const value = decl.slice(colon + 1).trim()
    if (!name || !value) continue
    out[kebabToCamel(name)] = value
  }
  return Object.keys(out).length ? (out as CSSProperties) : undefined
}

// Coerce whatever GrapesJS hands us into a React style object.
export const normalizeStyleObject = (
  value: unknown
): CSSProperties | undefined => {
  if (!value) return undefined

  if (typeof value === "object" && !Array.isArray(value)) {
    return kebabKeysToCamelStyle(value as Record<string, unknown>)
  }

  if (typeof value === "string") {
    let parsed = parseStyleString(value)
    if (!parsed) {
      try {
        const json = JSON.parse(value)
        if (json && typeof json === "object" && !Array.isArray(json)) {
          parsed = kebabKeysToCamelStyle(json as Record<string, unknown>)
        }
      } catch (err) {
        console.error("Failed to parse style string as JSON", err)
      }
    }
    return parsed
  }

  if (Array.isArray(value)) {
    const out: Record<string, string | number> = {}
    for (const entry of value) {
      if (!entry || typeof entry !== "object") continue
      const e = entry as { name?: string; property?: string; value?: unknown }
      const name = e.name || e.property
      const v = e.value
      if (typeof name !== "string" || !name) continue
      if (v === undefined || v === "") continue
      if (typeof v !== "string" && typeof v !== "number") continue
      out[kebabToCamel(name)] = v
    }
    return Object.keys(out).length ? (out as CSSProperties) : undefined
  }

  return undefined
}
