// React treats raw form controls as (un)controlled inputs: children on
// <textarea> throw and `selected` on <option> warns — initial state must be
// expressed as defaultValue on the control instead. GrapesJS stores the
// parsed-HTML shape, so the canvas and project renderers both normalize
// through these helpers.

export interface OptionInfo {
  selected: boolean
  /** The value attribute; an option without one submits its text. */
  value?: string
  text: string
}

/** True when a parsed boolean attribute (selected, multiple, ...) is present:
 * GrapesJS stores `true` or a string for set attributes and `false`/nullish
 * for unset ones. */
export const booleanAttrPresent = (v: unknown): boolean =>
  v !== undefined && v !== null && v !== false

/** defaultValue for a <select>, derived from its options: HTML keeps the LAST
 * selected option for single selects, all of them for multiple. */
export const selectDefaultValue = (
  options: OptionInfo[],
  multiple: boolean
): string | string[] | undefined => {
  const values = options
    .filter((o) => o.selected)
    .map((o) => o.value ?? o.text)
  if (values.length === 0) return undefined
  return multiple ? values : values[values.length - 1]
}
