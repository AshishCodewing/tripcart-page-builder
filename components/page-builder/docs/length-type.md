# Custom `"length"` Style Manager Type

## Problem

GrapesJS's built-in `number` type uses the `PropertyNumber` model internally. That
model parses every value with a regex that expects a bare number followed by a known
unit (`16px`, `50%`, `2rem`, …). Any value that doesn't match — CSS variables
(`var(--spacing-4)`), calc expressions, or arbitrary strings — is either rejected or
mangled before it reaches the canvas.

Border-radius sub-properties need to accept all of these, so the built-in `number`
type is not usable here.

## Solution

Register a custom type called `"length"` with an empty definition:

```ts
// editor-shell.tsx (inside plugins array)
editor.StyleManager.addType("length", {})
```

An empty `{}` definition tells GrapesJS two things:

1. `"length"` is a valid, known type — don't treat it as unknown.
2. There are no native `create` / `emit` / `update` hooks — the React UI owns
   rendering entirely.

Because it is a **custom** type (not the built-in `number`), GrapesJS assigns the
base `Property` model instead of `PropertyNumber`. The base model stores whatever
string is passed to `property.upValue()` verbatim, with no regex validation.

## How the type string flows

```
editor-shell.tsx sector config
  { type: "length", property: "border-top-left-radius", default: "0" }
          │
          ▼
  addType("length", {})  →  GrapesJS assigns base Property model
          │                  (no unit parsing, no regex validation)
          ▼
  property.getType() === "length"
          │
          ▼
  PropertyField switch case (property-field.tsx)
    case "length":
    case "number":
      → <NumberField />
          │
          ▼
  varCategoriesFor(property) — gated on getType() === "length"
    → returns token categories (e.g. ["border-radius"])
    → CssVarPicker addon is shown
          │
          ▼
  NumberInput.commit()
    • bare number ("16") → auto-appended to "16px"   (only when varCategories set)
    • CSS var ("var(--sz-4)") → passed through as-is
    • any valid CSS string → passed through as-is
          │
          ▼
  property.upValue(value)  →  stored verbatim, canvas updated
```

## Comparison: `number` vs `"length"`

| | Built-in `number` | Custom `"length"` |
|---|---|---|
| GrapesJS model | `PropertyNumber` | base `Property` |
| Value validation | regex — rejects CSS vars | none — verbatim storage |
| Unit handling | parsed and stored separately | raw string |
| CSS variable picker | no | yes (gated on `getType() === "length"`) |
| Auto-append `px` | no | yes, on bare numeric input |

## Where each piece lives

| File | Role |
|---|---|
| `editor-shell.tsx` | `addType("length", {})` registration; sector properties using `type: "length"` |
| `property-field.tsx:63` | Switch case routes `"length"` → `<NumberField />` |
| `number-field.tsx:142` | `varCategoriesFor` — gated on `"length"`, maps property name to token categories |
| `number-field.tsx:98` | Auto-px logic — only fires when `varCategories` is set (i.e. `type === "length"`) |
| `number-field.tsx:169` | `property.upValue(next)` — writes back to GrapesJS model |

## Why a separate type name instead of reusing `"number"`

Using a distinct `"length"` name gives a stable contract between the GrapesJS model
and the React UI router. It lets `varCategoriesFor` distinguish "this property holds
a CSS dimension" from "this property holds a bare number" (e.g. `z-index`, `opacity`,
`flex-grow`) without inspecting the property name in multiple places. All
dimension-type properties opt in by declaring `type: "length"`; the CssVarPicker and
auto-px behaviour follow automatically.
