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

// Parse a string value. A JSON-encoded style object (stored attribute) starts
// with `{`, so try JSON.parse first for those — otherwise the declaration
// parser would mis-read the JSON's `:` as a single CSS declaration. Anything
// else (or JSON that fails to parse) falls through to the "a:b;c:d"
// declaration list. A bare word that matches neither returns undefined
// silently — that's expected, not an error.
const parseStringStyle = (value: string): CSSProperties | undefined => {
  if (value.trim().startsWith("{")) {
    try {
      const json = JSON.parse(value)
      if (json && typeof json === "object" && !Array.isArray(json)) {
        return kebabKeysToCamelStyle(json as Record<string, unknown>)
      }
    } catch {
      // Not valid JSON after all; fall through to the declaration parser.
    }
  }
  return parseStyleString(value)
}

// Parse a `[{ name|property, value }]` array into a React style object,
// keeping only string/number values under non-empty keys.
const parseStyleArray = (entries: unknown[]): CSSProperties | undefined => {
  const out: Record<string, string | number> = {}
  for (const entry of entries) {
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

// Coerce whatever GrapesJS hands us into a React style object, dispatching on
// the input shape (object / string / array).
export const normalizeStyleObject = (
  value: unknown
): CSSProperties | undefined => {
  if (!value) return undefined
  if (Array.isArray(value)) return parseStyleArray(value)
  if (typeof value === "string") return parseStringStyle(value)
  if (typeof value === "object") {
    return kebabKeysToCamelStyle(value as Record<string, unknown>)
  }
  return undefined
}
