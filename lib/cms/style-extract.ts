/**
 * Precise per-subtree CSS extraction for the convert-to-template flow
 * (§6 in docs/reference/templates-followups.md).
 *
 * When a selection is promoted to a Template, only the Style-Manager
 * rules that actually target the converted subtree should ride along in
 * `Template.data.styles` — not the page's entire `styles[]`. This module
 * walks the subtree to collect the ids/classes it owns, then filters the
 * page's serialized rules down to those whose selectors reference one of
 * them.
 *
 * Pure functions, no server imports — safe to import from the client
 * dialog (`convert-template-dialog.tsx`) as well as from server code.
 *
 * Matching is by exact id/class *name* (GrapesJS serializes selectors
 * without the `#`/`.` prefix and carries the kind in `type`), so there's
 * no substring footgun (`foo` won't match `foobar`). Per the design note
 * we over-include rather than miss: a rule matches if *any* of its
 * selectors references the subtree, so a compound like `#id.is-active`
 * still comes along even though the `.is-active` state class isn't a
 * component class.
 */

import type {
  ComponentDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"

/** GrapesJS Selector type discriminator: 1 = class, 2 = id. */
const SELECTOR_TYPE_ID = 2

export type SubtreeIdentity = {
  ids: Set<string>
  classes: Set<string>
}

type SelectorEntry =
  | string
  | { name?: string; type?: number; label?: string; [k: string]: unknown }

/** Add this node's ids (top-level `id` + `attributes.id`) to the accumulator. */
function addNodeIds(node: ComponentDefinition, ids: Set<string>): void {
  if (typeof node.id === "string") ids.add(node.id)
  const attrId = node.attributes?.id
  if (typeof attrId === "string") ids.add(attrId)
}

/**
 * Add this node's classes to the accumulator: the `classes[]` array (string
 * or `{ name }` entries) plus a space-separated `attributes.class` string.
 */
function addNodeClasses(node: ComponentDefinition, classes: Set<string>): void {
  if (Array.isArray(node.classes)) {
    for (const c of node.classes) {
      if (typeof c === "string") classes.add(c)
      else if (c && typeof c === "object" && typeof c.name === "string")
        classes.add(c.name)
    }
  }
  const attrClass = node.attributes?.class
  if (typeof attrClass === "string") {
    for (const token of attrClass.split(/\s+/)) {
      if (token) classes.add(token)
    }
  }
}

/**
 * Recursively collect every id and class name that appears anywhere in a
 * component subtree. Handles ids from both the top-level `id` field and
 * `attributes.id`, and classes from the `classes[]` array (string or
 * `{ name }` entries) plus a space-separated `attributes.class` string.
 */
export function collectComponentIdentity(
  node: ComponentDefinition | undefined,
  acc: SubtreeIdentity = { ids: new Set(), classes: new Set() }
): SubtreeIdentity {
  if (!node || typeof node !== "object") return acc

  addNodeIds(node, acc.ids)
  addNodeClasses(node, acc.classes)

  if (Array.isArray(node.components)) {
    for (const child of node.components) collectComponentIdentity(child, acc)
  }
  return acc
}

/** Scan a raw selector string (combinators, pseudos, tag selectors that
 * GrapesJS keeps in `selectorsAdd`) for `#id` / `.class` tokens. */
function rawSelectorMentions(raw: string, identity: SubtreeIdentity): boolean {
  const tokens = raw.match(/[#.][\w-]+/g)
  if (!tokens) return false
  for (const token of tokens) {
    const name = token.slice(1)
    if (token[0] === "#" && identity.ids.has(name)) return true
    if (token[0] === "." && identity.classes.has(name)) return true
  }
  return false
}

/**
 * Match a bare string selector. These come in two shapes: component
 * selectors serialize as bare class names ("gjs-grid-row"), while rules
 * added via raw `setRule`/`addRules` keep the prefix ("#secA" / ".a-box").
 */
function stringSelectorMatches(
  sel: string,
  identity: SubtreeIdentity
): boolean {
  if (sel.startsWith("#")) return identity.ids.has(sel.slice(1))
  if (sel.startsWith(".")) return identity.classes.has(sel.slice(1))
  return identity.classes.has(sel)
}

/** Match a `{ name, type }` selector object (component id/class selectors). */
function objectSelectorMatches(
  sel: { name?: string; type?: number },
  identity: SubtreeIdentity
): boolean {
  if (typeof sel.name !== "string") return false
  return sel.type === SELECTOR_TYPE_ID
    ? identity.ids.has(sel.name)
    : identity.classes.has(sel.name)
}

/** Dispatch a single selector entry to the matcher for its shape. */
function selectorMatches(
  sel: SelectorEntry,
  identity: SubtreeIdentity
): boolean {
  if (typeof sel === "string") return stringSelectorMatches(sel, identity)
  if (sel && typeof sel === "object") {
    return objectSelectorMatches(sel, identity)
  }
  return false
}

function ruleMatchesSubtree(rule: Rule, identity: SubtreeIdentity): boolean {
  const selectors = (rule as { selectors?: unknown }).selectors
  if (Array.isArray(selectors)) {
    for (const sel of selectors as SelectorEntry[]) {
      if (selectorMatches(sel, identity)) return true
    }
  }

  const add = (rule as { selectorsAdd?: unknown }).selectorsAdd
  if (typeof add === "string" && add.length > 0) {
    return rawSelectorMentions(add, identity)
  }
  return false
}

/**
 * Filter a page's serialized rules down to those that target the given
 * subtree. Returns a new array (the matched rule objects, unchanged) so
 * callers can serialize it straight into `Template.data.styles`.
 *
 * Returns `[]` when the subtree carries no ids/classes — there's nothing
 * a rule could reference, so nothing rides along. Tailwind/class-based
 * components are unaffected: their styling lives on the component, not in
 * `styles[]`.
 */
export function extractStylesForSubtree(
  allStyles: Rule[],
  subtree: ComponentDefinition | undefined
): Rule[] {
  if (!Array.isArray(allStyles) || allStyles.length === 0) return []
  const identity = collectComponentIdentity(subtree)
  if (identity.ids.size === 0 && identity.classes.size === 0) return []
  return allStyles.filter((rule) => ruleMatchesSubtree(rule, identity))
}

/* -------------------------------------------------------------------------- *
 *  Id re-keying for repeated unsynced drops (§8 caveat).                      *
 *                                                                            *
 *  An unsynced template block's `content` is a fixed snapshot of the         *
 *  template subtree, so dropping it twice instantiates two copies sharing    *
 *  the same component ids — and therefore the same seeded `#id` CSS rule.    *
 *  With the editor in component-first mode a Style-Manager edit targets an   *
 *  ID rule, so editing one copy would silently restyle the other. The fix    *
 *  (`lib/plugins/template-blocks.ts`) regenerates the dropped copy's ids and *
 *  re-keys the seeded rules through `remapStyleIds` so each instance owns    *
 *  its own rules. Classes are intentionally left untouched: shared classes   *
 *  stay the common base, and component-first per-instance edits land on ids. *
 * -------------------------------------------------------------------------- */

/** Read the id name a selector entry targets, or null if it isn't an id. */
function selectorIdName(sel: SelectorEntry): string | null {
  if (typeof sel === "string") return sel.startsWith("#") ? sel.slice(1) : null
  if (sel && typeof sel === "object" && sel.type === SELECTOR_TYPE_ID) {
    return typeof sel.name === "string" ? sel.name : null
  }
  return null
}

/**
 * Collect every id *name* that the given rules target — across `selectors`
 * (string `#id` or `{ name, type: 2 }` objects) and the raw `selectorsAdd`
 * string. This is the set of ids that must be regenerated on the dropped
 * copy so its rules don't collide with an earlier copy's.
 */
export function collectStyledIds(styles: Rule[]): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(styles)) return ids
  for (const rule of styles) {
    const selectors = (rule as { selectors?: SelectorEntry[] }).selectors
    if (Array.isArray(selectors)) {
      for (const sel of selectors) {
        const name = selectorIdName(sel)
        if (name) ids.add(name)
      }
    }
    const add = (rule as { selectorsAdd?: unknown }).selectorsAdd
    if (typeof add === "string") {
      for (const m of add.matchAll(/#([\w-]+)/g)) ids.add(m[1])
    }
  }
  return ids
}

/** Rewrite one selector entry's id name through `idMap` (no-op for classes). */
function remapSelectorEntry(
  sel: SelectorEntry,
  idMap: Map<string, string>
): SelectorEntry {
  if (typeof sel === "string") {
    if (!sel.startsWith("#")) return sel
    const mapped = idMap.get(sel.slice(1))
    return mapped ? `#${mapped}` : sel
  }
  if (sel && typeof sel === "object" && sel.type === SELECTOR_TYPE_ID) {
    if (typeof sel.name !== "string") return sel
    const mapped = idMap.get(sel.name)
    return mapped ? { ...sel, name: mapped } : sel
  }
  return sel
}

/** Rewrite `#id` tokens inside a raw selector string (`selectorsAdd`). */
function remapRawSelector(raw: string, idMap: Map<string, string>): string {
  return raw.replace(/#([\w-]+)/g, (token, name: string) => {
    const mapped = idMap.get(name)
    return mapped ? `#${mapped}` : token
  })
}

/**
 * Return copies of `styles` with id references rewritten through `idMap`
 * (oldId → newId). Inputs are never mutated — the block registry re-reads
 * the originals on the next drop, which must remap from the pristine ids.
 * Classes pass through unchanged (see the section comment above).
 */
export function remapStyleIds(
  styles: Rule[],
  idMap: Map<string, string>
): Rule[] {
  if (!Array.isArray(styles) || idMap.size === 0) return styles
  return styles.map((rule) => {
    const next = { ...rule } as Rule & {
      selectors?: SelectorEntry[]
      selectorsAdd?: unknown
    }
    if (Array.isArray(next.selectors)) {
      next.selectors = next.selectors.map((sel) =>
        remapSelectorEntry(sel, idMap)
      ) as Rule["selectors"]
    }
    if (typeof next.selectorsAdd === "string") {
      next.selectorsAdd = remapRawSelector(next.selectorsAdd, idMap)
    }
    return next
  })
}
