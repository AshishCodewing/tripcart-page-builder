# Length properties: `PropertyNumber` + `fixedValues`

## Background

Authoring CSS lengths in this builder means accepting two kinds of input:

- Numeric values with a unit (`16px`, `100%`, `1.5rem`, `2em`)
- CSS expressions and identifiers (`var(--sz-4)`, `calc(100% - 20px)`, `auto`, `inherit`)

GrapesJS's built-in `number` type maps to the `PropertyNumber` model. Its
`validateInputValue` runs every input through `parseFloat`, which silently
drops anything that isn't a number+known-unit pair. A first iteration of this
codebase worked around that by registering `addType("length", {})` — an empty
custom type that fell back to the base `Property` model and stored values
verbatim. That preserved expressions but lost `PropertyNumber`'s native
`getUnits()` / `upUnit()` API, so the right-panel had no real unit selector.

## Current architecture

Every length-like property is registered as `type: "number"` (i.e. uses
`PropertyNumber` natively) and is configured with two extra fields:

- `units: string[]` — the unit list shown in the unit dropdown.
- `fixedValues: string[]` — regex alternatives matched anchored at `^` by
  GrapesJS. Matches are preserved verbatim and unit is cleared. See
  `node_modules/grapesjs/dist/grapes.mjs:49996-50001`.

Both come from a shared helper at
`components/page-builder/style-fields/length-props.ts`:

```ts
import { lengthProp } from "./style-fields/length-props"

// In a sector's `properties` array:
lengthProp("width", { extend: "width" })
lengthProp("margin-top", { default: "0" })
lengthProp("flex-basis", { default: "auto" })
```

`LENGTH_FIXED_VALUES` covers the common identifiers (`auto`, `inherit`,
`initial`, `unset`, `none`, `fit-content`, `max-content`, `min-content`) plus
two regex entries: `var\([^)]*\)` and `calc\([^)]*\)`. CSS variables
(`var(--sz-4)`) and single-level `calc(100% - 20px)` are preserved through
`validateInputValue` because they match those regexes.

`LENGTH_UNITS_BY_PROPERTY` defines per-name unit lists (e.g. `width` uses
`["px", "%", "em", "rem", "vh", "vw"]`, `font-size` uses
`["px", "rem", "em", "%"]`, `line-height` uses `["", "px", "em", "%"]` where
the empty entry allows unitless line-height).

## Known limitation

`fixedValues` matches a regex prefix. The `var(...)` regex `var\([^)]*\)` and
the `calc(...)` regex `calc\([^)]*\)` both use a **non-recursive** `[^)]*`
class — they truncate at the first `)`. Single-level expressions work:

- ✅ `var(--space-md)` → preserved
- ✅ `calc(100% - 20px)` → preserved
- ❌ `calc(var(--a) + 10px)` → truncates to `calc(var(--a)` and breaks

The project explicitly accepted this trade. Authors are not expected to write
nested-paren expressions; the CSS variable picker covers the common need.

## React side

`components/page-builder/style-fields/number-field.tsx` reads the canonical
model API:

| Read | Source |
|---|---|
| Composed string for the text field | `property.getFullValue()` |
| Available units | `property.getUnits()` |
| Current unit | `property.getUnit()` |

Writes:

| Action | Call |
|---|---|
| Text input commit | `property.upValue(string)` |
| Unit dropdown change | `property.upUnit(unit)` |

`parseValueShape(raw)` classifies the live draft into `empty`, `numeric`, or
`fixed` so the commit flow can compose / pass-through correctly and the unit
dropdown can disable itself (showing `—`) when the value isn't a parseable
number.

## Why `PropertyNumber` works without a hosted view

`PropertyNumber.initialize` instantiates its own `InputNumber` view at model
construction time (`grapes.mjs:64602`). `parseValue` calls
`this.input.validateInputValue(...)` against that internal view, so input
validation works whether or not the GrapesJS view is mounted into the DOM.
Our React UI reads the model directly; the native view never renders because
`panels: { defaults: [] }` (`editor-shell.tsx`) disables the legacy panels.
