// Pure mapping helpers for ComponentNode (models.ts). Kept separate so the
// type→tag table and class normalization are unit-testable without hydrating
// a full component tree.

// GrapesJS component type → canonical HTML tag. Types not listed fall back to
// the persisted `tagName`, then empty string.
const TYPE_TO_TAG: Record<string, string> = {
  svg: "svg",
  image: "img",
  linkBox: "a",
  link: "a",
  head: "head",
  wrapper: "body",
}

export const resolveTagName = (
  type: string,
  persistedTagName: string | undefined
): string => TYPE_TO_TAG[type] ?? persistedTagName ?? ""

// `classes` may carry plain strings or `{ name, ... }` objects; normalize to
// a flat string[].
export const normalizeClasses = (
  classes: ReadonlyArray<string | { name: string }> | undefined
): string[] => (classes ?? []).map((c) => (typeof c === "string" ? c : c.name))
