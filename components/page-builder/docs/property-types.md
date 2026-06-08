# Style property types

`PropertyField` (in `property-field.tsx`) dispatches on `property.getType()` and
renders one leaf field per type. The type comes from GrapesJS's built-in
`buildProps` registry — it's keyed off the property *name*, not the CSS spec —
so `text-align` is `radio` while `font-family` is `select` even though both are
"pick from a list" in CSS.

Override per property in `editor-shell.tsx` with `{ extend: 'name', type: '…' }`
or a fully-defined property object.

## Type → field map

The lists below cover the properties currently registered in
`editor-shell.tsx` (`styleManager.sectors`). Properties not in your config but
that GrapesJS would assign to the same case are noted in parentheses.

### `number` / `integer` / `slider` → `NumberField`

Numeric values, optionally with units (px / % / em / vh / vw).

- `width`, `height`, `min-width`, `min-height`, `max-width`, `max-height`
- `top`, `right`, `bottom`, `left`
- `gap`, `font-size`, `line-height`, `letter-spacing`, `border-radius`
- `flex-basis`
- **integer** (no units): `order`, `flex-grow`, `flex-shrink`
- **slider**: nothing currently — reserved for properties registered with
  `type: 'slider'` (e.g. opacity)

### `color` → `ColorField`

- `color`, `background-color`
- (`border-color` if the `border` composite is split out)

### `select` → `SelectField`

Dropdown of named options.

- `display`, `position`
- `flex-direction`, `justify-content`, `align-items`, `align-content`,
  `align-self`, `flex-wrap`
- `font-family`, `font-weight`

### `radio` → `RadioField`

Button group with icons supplied by `option-icons.ts`.

- `text-align` — ships as `radio` by default (left / center / right / justify)
- (`font-style`, `text-decoration` if added)

### `file` → `FileField`

URL file picker.

- `background-image`

### `stack` → `StackField`

Multi-layer properties. Each layer renders as a `LayerRow`; the selected
layer's sub-properties are edited in the form below the list.

- `box-shadow`
- (`background`, `text-shadow`, `transition`, `transform` if added)

### `composite` → `CompositeField`

Properties with sub-properties rendered as a nested form.

- `margin`, `padding` (top / right / bottom / left sub-props)
- `border` (width / style / color sub-props)
- `flex` — declared explicitly in `editor-shell.tsx` with sub-props
  `flex-grow`, `flex-shrink`, `flex-basis`. The Auto / Fill / Hug preset on
  top is rendered by `FlexPresetField`, gated to the `flex` composite name in
  `CompositeField`.

### default → `BaseField`

Plain text input. Catch-all for any property whose type isn't in the
registry — string values or custom properties registered without a `type`.
Nothing in the current config hits this, but it's the safety net.

## Layout: inline vs block rows

`PropertyField` wraps every field in `PropertyRow`. The row picks its layout
from the property type:

- `stack` and `composite` render their own headers (layer rows / sub-field
  forms) → `layout="block"` so the label sits on its own line.
- Everything else → `layout="inline"` (label on the left, field on the right).

## Visibility gating

`PropertyField` returns `null` when `property.isVisible()` is false. Visibility
rules live in `visibility.ts` and currently gate flex container/child
properties to the right `display` value (see `lib/plugins/columns/index.ts`).
