// Parsers that coerce the polymorphic style values GrapesJS surfaces (object,
// "a:b;c:d" string, [{name,value}] array, or a JSON-encoded object string) into
// a React style object. Each parser handles exactly one input shape; the
// dispatch lives in ./style (normalizeStyleObject).

import type { CSSProperties } from "react"

import { kebabToCamel } from "./case-utils"

// Only string/number are valid CSS property values for our purposes.
const isStyleValue = (v: unknown): v is string | number =>
  typeof v === "string" || typeof v === "number"

// Map an object of kebab-case keys to a React style object, keeping only
// string/number values. Returns undefined when nothing survives.
export const kebabKeysToCamelStyle = (
  styles: Record<string, unknown>
): CSSProperties | undefined => {
  const out: Record<string, string | number> = {}
  let any = false
  for (const key in styles) {
    if (!Object.prototype.hasOwnProperty.call(styles, key)) continue
    const value = styles[key]
    if (isStyleValue(value)) {
      out[kebabToCamel(key)] = value
      any = true
    }
  }
  return any ? (out as CSSProperties) : undefined
}

// Parse a single "key: value" declaration into a [camelKey, value] tuple, or
// undefined when the declaration is empty/malformed.
const parseDeclaration = (decl: string): [string, string] | undefined => {
  if (!decl.trim()) return undefined
  const colon = decl.indexOf(":")
  if (colon <= 0) return undefined
  const name = decl.slice(0, colon).trim()
  const value = decl.slice(colon + 1).trim()
  if (!name || !value) return undefined
  return [kebabToCamel(name), value]
}

const parseStyleString = (str: string): CSSProperties | undefined => {
  const out: Record<string, string> = {}
  for (const decl of str.split(";")) {
    const parsed = parseDeclaration(decl)
    if (parsed) out[parsed[0]] = parsed[1]
  }
  return Object.keys(out).length ? (out as CSSProperties) : undefined
}

// Parse a string value. A JSON-encoded style object (stored attribute) starts
// with `{`, so try JSON.parse first for those — otherwise the declaration
// parser would mis-read the JSON's `:` as a single CSS declaration. Anything
// else (or JSON that fails to parse) falls through to the "a:b;c:d"
// declaration list. A bare word that matches neither returns undefined
// silently — that's expected, not an error.
export const parseStringStyle = (value: string): CSSProperties | undefined => {
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

// Pull the [camelKey, value] out of one `{ name|property, value }` entry, or
// undefined when the entry is malformed or its value isn't string/number.
const parseStyleEntry = (
  entry: unknown
): [string, string | number] | undefined => {
  if (!entry || typeof entry !== "object") return undefined
  const e = entry as { name?: string; property?: string; value?: unknown }
  const name = e.name || e.property
  const v = e.value
  if (typeof name !== "string" || !name) return undefined
  if (v === "" || !isStyleValue(v)) return undefined
  return [kebabToCamel(name), v]
}

// Parse a `[{ name|property, value }]` array into a React style object,
// keeping only string/number values under non-empty keys.
export const parseStyleArray = (
  entries: unknown[]
): CSSProperties | undefined => {
  const out: Record<string, string | number> = {}
  for (const entry of entries) {
    const parsed = parseStyleEntry(entry)
    if (parsed) out[parsed[0]] = parsed[1]
  }
  return Object.keys(out).length ? (out as CSSProperties) : undefined
}
