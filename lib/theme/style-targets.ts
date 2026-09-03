// A `StyleTarget` names one addressable style block in the theme document, and
// is the single vocabulary the Blocks screen speaks: the panel derives one from
// its selection, every field reads and writes through it, and the compiler's
// own nesting rules are encoded once here in `targetPath`.
//
// Two shapes, mirroring the two halves of `styles`:
//   - elements (`styles.elements.<name>`): a base block, optional `variations`
//     (WP block style variations), optional pseudo state.
//   - components (`styles.components.<type>`): a root block whose declarations
//     stay top-level, optional named `parts`, optional `states` keyed by
//     selector suffix.
//
// Which parts/states/style-groups a component may use comes from its
// `StyleSurface`, so the UI can't offer something `componentsSchema` would
// reject at save time.

import type { ElementName, Theme } from "@/lib/theme/schema"
import {
  getAtPath,
  isEqualJson,
  setAtPath,
  type Path,
} from "@/lib/theme/style-paths"
import {
  ELEMENT_PSEUDO_KEYS,
  elementSelectors,
  joinWithSuffix,
  type ElementPseudoKey,
} from "@/lib/theme/style-selectors"
import {
  getStylePart,
  STYLE_GROUPS,
  type StyleGroup,
} from "@/lib/theme/style-surfaces"

export type { ElementPseudoKey } from "@/lib/theme/style-selectors"

export type StyleTarget =
  | {
      kind: "element"
      name: ElementName
      variation?: string
      state?: ElementPseudoKey
    }
  | { kind: "component"; type: string; part?: string; state?: string }

/** Absolute path from the Theme root to the StyleBlock the target addresses. */
export const targetPath = (target: StyleTarget): string[] =>
  target.kind === "element"
    ? [
        "styles",
        "elements",
        target.name,
        ...(target.variation ? ["variations", target.variation] : []),
        ...(target.state ? [target.state] : []),
      ]
    : [
        "styles",
        "components",
        target.type,
        ...(target.part ? ["parts", target.part] : []),
        ...(target.state ? ["states", target.state] : []),
      ]

const setIn = (theme: Theme, path: Path, value: unknown): Theme => {
  const next = setAtPath(
    theme as unknown as Record<string, unknown>,
    path,
    value
  )
  return (next as unknown as Theme | undefined) ?? theme
}

/**
 * Path to the whole entry a target belongs to — the element, or the component
 * — ignoring variation, part and state. "Reset styles" operates at this level,
 * as WP's does: everything a tenant changed on that block goes at once.
 */
export const entryPath = (target: StyleTarget): string[] =>
  target.kind === "element"
    ? ["styles", "elements", target.name]
    : ["styles", "components", target.type]

/**
 * Put a block back to how `defaults` defines it — the whole element or
 * component, every variation, part and state included. The default block is
 * copied in (not deleted) because the store holds the merged theme: with
 * merge-on-read, a missing key is what the defaults would fill on the next
 * load, so copying now is what keeps the canvas and the saved result equal.
 * Removes the entry when the defaults have none.
 */
export const resetStyleBlock = (
  theme: Theme,
  target: StyleTarget,
  defaults: Theme
): Theme => {
  const path = entryPath(target)
  const block = getAtPath(defaults, path)
  if (isEqualJson(getAtPath(theme, path), block)) return theme
  return setIn(
    theme,
    path,
    block === undefined ? undefined : structuredClone(block)
  )
}

/**
 * Write (or, with `undefined`, clear) one declaration. Only the branch under
 * the target is rebuilt; `settings` and sibling elements/components keep their
 * identity. Returns the same theme when nothing changed. The root can't prune
 * away because `version` and `settings` are always present.
 */
export const setStyleValue = (
  theme: Theme,
  target: StyleTarget,
  path: Path,
  value: string | undefined
): Theme => setIn(theme, [...targetPath(target), ...path], value)

/**
 * Style groups the target may edit — all of them unless the part narrows it.
 * Empty for a component with no surface, or an unknown part: there is nothing
 * addressable, so there is nothing to edit.
 */
export const supportsFor = (target: StyleTarget): readonly StyleGroup[] => {
  if (target.kind === "element") return STYLE_GROUPS
  const part = getStylePart(target.type, target.part)
  return part ? (part.supports ?? STYLE_GROUPS) : []
}

/**
 * The CSS selector this target compiles to — the string the Blocks screen
 * hands to `StyleManager.select()`, so the editor's controls write to the very
 * rule `compileTheme` emits. Built from the same primitives the compiler uses.
 *
 * Undefined when there is nothing addressable: a component type with no
 * registered surface, or an unknown part.
 */
export const targetSelector = (target: StyleTarget): string | undefined => {
  const suffix = target.state ?? ""
  if (target.kind === "element") {
    return joinWithSuffix(
      elementSelectors(target.name, target.variation),
      suffix
    )
  }
  const selector = getStylePart(target.type, target.part)?.selector
  return selector ? `${selector}${suffix}` : undefined
}

/** State suffixes the target's owner declares. */
export const statesFor = (target: StyleTarget): readonly string[] => {
  if (target.kind === "element") return ELEMENT_PSEUDO_KEYS
  return getStylePart(target.type, target.part)?.states ?? []
}
