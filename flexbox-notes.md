# Flexbox — primer and how it's wired into the editor

## Part 1 — Flexbox mental model

Flexbox is a **1-dimensional layout system**: it arranges items along a single axis (a row or a column). The parent decides the axis and how to distribute space; each child can override how *it* behaves within that space.

### The parent (flex container)

Opt in with `display: flex` (or `inline-flex`). Once an element is a flex container, two axes exist:

- **main axis** — set by `flex-direction` (`row` default, or `column`, plus `*-reverse`)
- **cross axis** — perpendicular to the main axis

Key parent properties:

| Property | What it controls |
|---|---|
| `flex-direction` | Which axis is "main" (`row` / `column`) |
| `flex-wrap` | Whether items wrap onto new lines (`nowrap` default) |
| `justify-content` | Distribution along the **main** axis (`flex-start`, `center`, `space-between`, `space-around`, `space-evenly`) |
| `align-items` | Alignment along the **cross** axis (`stretch` default, `center`, `flex-start`, `flex-end`, `baseline`) |
| `align-content` | Distribution of *wrapped lines* along cross axis (only matters when wrapping) |
| `gap` | Spacing between items (replaces margin hacks) |

### The children (flex items)

Each child negotiates its size along the main axis via three properties, usually written together as the `flex` shorthand:

```css
flex: <grow> <shrink> <basis>;
```

- **`flex-basis`** — the item's *starting size* along the main axis, **before** grow/shrink runs. Defaults to `auto` (= content size). You can use `0`, `200px`, `30%`, etc.
- **`flex-grow`** — how greedy the item is when there's *extra* space. A ratio, not a unit. If three items have grow `1, 1, 2`, leftover space splits 25%/25%/50%.
- **`flex-shrink`** — how willing the item is to *give up* space when there isn't enough. Also a ratio. `0` = "never shrink me."

Common `flex` shorthands:

| Shorthand | Expands to | Meaning |
|---|---|---|
| `flex: 1` | `1 1 0%` | "Fill available space, share equally" |
| `flex: auto` | `1 1 auto` | "Start at content size, then grow/shrink" |
| `flex: none` | `0 0 auto` | "Don't grow or shrink — be content-sized" |
| `flex: 0 0 200px` | as written | "Fixed 200px, never flex" |

The big gotcha: **`flex: 1` sets basis to `0`**, so item content size is ignored — all items start from zero and grow equally. If you want content size to influence the split, use `flex: auto` or `flex: 1 1 auto`.

Per-item overrides:

- **`align-self`** — override the parent's `align-items` for just this child.
- **`order`** — reorder visually without changing the DOM (integer, default `0`). Bad for accessibility/tab order; use sparingly.

### The mental model that actually helps

1. Container declares the **main axis** and **how leftover space is distributed**.
2. Each item declares its **basis** (where it starts), then **grow/shrink ratios** decide who takes/gives space.
3. Cross-axis alignment is a separate concern — `align-items` on the parent, `align-self` on the child.

If layout feels wrong, the question is almost always one of:
- "What's the main axis here?" (check `flex-direction`)
- "Is `flex-basis` content size or zero?" (check whether you used `flex: 1` vs `flex: auto`)
- "Can this item shrink?" (check `flex-shrink` and `min-width`/`min-height` — items have an implicit `min-width: auto` that often prevents shrinking below content size; set `min-width: 0` to fix overflow issues in text-heavy children).

---

## Part 2 — How it's wired into `editor-shell.tsx`

The flex UI is configured entirely inside the `styleManager.sectors` array on the `layout` sector (lines 105–163 of `components/page-builder/editor-shell.tsx`). Everything else — the actual rendering of inputs, the gating of "child-only" properties, the preset radio — lives in other files this config points at.

### 1. The shape of a sector property

Each entry in `properties:` is one of three forms:

```ts
// (a) bare string — use the GrapesJS built-in as-is
"display"
"flex-wrap"

// (b) { extend: "name", ... } — start from a built-in, override fields
{ extend: "flex-direction", type: "radio" }

// (c) fully-defined object — register a brand-new property
{ property: "gap", type: "composite", default: "0px", properties: [...] }
```

GrapesJS ships built-in definitions for `flex-direction`, `justify-content`, etc. (units, option lists, default values). The `extend` form means "keep all of that, just change `type` so my custom Field component renders it." The radio overrides on lines 115, 116, 117, 130, 132 do exactly this — the built-ins default to `select` dropdowns, but this app wants icon-radio toggles.

### 2. Container vs. child properties

Both live in the same sector, separated by comments:

**Container properties** (apply when this element *is* `display: flex`):

| Line | Property | Form |
|---|---|---|
| 111 | `display` | bare string |
| 115 | `flex-direction` | extended → radio |
| 116 | `justify-content` | extended → radio |
| 117 | `align-items` | extended → radio |
| 120–128 | `gap` | **custom composite** |
| 129 | `flex-wrap` | bare string |
| 130 | `align-content` | extended → radio |

**Flex child properties** (apply when the *parent* is `display: flex`):

| Line | Property | Form |
|---|---|---|
| 132 | `align-self` | extended → radio |
| 133–137 | `order` | extended → integer with `default: "0"` |
| 142–161 | `flex` | **custom composite** (grow/shrink/basis) |

The comments on lines 112–113 and 131 mention that `visibility.ts` is what actually *hides* these properties when they don't apply (e.g. flex-child properties disappear when the parent isn't a flex container). That logic lives outside this file.

### 3. The two composites — `gap` and `flex`

Composites are the interesting part. CSS gives you a shorthand (`gap: 12px 8px`, `flex: 1 1 0`); GrapesJS lets you decompose that into editable sub-properties while still writing the shorthand into the stylesheet.

#### `gap` (lines 120–128)

```ts
{
  property: "gap",
  type: "composite",
  default: "0px",
  properties: [
    lengthProp("row-gap",    { default: "0" }),
    lengthProp("column-gap", { default: "0" }),
  ],
}
```

Splits `gap` into `row-gap` + `column-gap` so the custom `GapField` (referenced in the comment on line 119) can edit each axis independently. `lengthProp` (imported from `./style-fields/length-props`) is a helper that produces a property definition with the standard length units (`px`, `%`, `em`, `rem`, etc.) wired up.

#### `flex` (lines 142–161)

```ts
{
  property: "flex",
  type: "composite",
  default: "0 0 auto",
  properties: [
    { property: "flex-grow",   type: "integer", default: "0", min: 0 },
    { property: "flex-shrink", type: "integer", default: "0", min: 0 },
    lengthProp("flex-basis", { default: "auto" }),
  ],
}
```

The default `"0 0 auto"` is the CSS spec default for `flex` — don't grow, don't shrink, basis is content size. The sub-properties mirror the three knobs from the flexbox model above:

- **`flex-grow`** — integer, min 0 (greediness ratio)
- **`flex-shrink`** — integer, min 0 (willingness-to-give-up ratio)
- **`flex-basis`** — length (starting size on the main axis)

The comment on lines 138–141 is the key bit: power users edit these three sub-properties directly, but the **Flex preset radio** (Auto / Fill / Hug) in `property-field.tsx → FlexPresetField` writes common combinations of these three at once. Roughly:

- **Auto** → `0 0 auto` (be your content size)
- **Fill** → `1 1 0%` (grow to fill available space)
- **Hug** → `0 0 auto` with an explicit width/height (size to content explicitly)

So the same underlying CSS is exposed two ways: a 3-button preset for the common cases, and the raw `flex-grow` / `flex-shrink` / `flex-basis` fields underneath for fine control.

### 4. How this connects to the rest of the editor

- `styleManager.sectors` is consumed by `style-settings.tsx` (custom Style Manager UI).
- Each property's `type` (`radio`, `integer`, `composite`, `select`, …) selects which React Field component renders the input.
- `visibility.ts` gates which properties show up for the currently-selected component (e.g. flex-child fields only render when parent is flex).
- The actual CSS is written back through GrapesJS's stylesheet, and the canvas iframe re-renders.

### 5. What `editor-shell.tsx` does *not* do

It doesn't render any of these inputs itself — `editor-shell.tsx` only **declares** what the Style Manager should expose. The visual presentation (icon radios, gap field, flex presets) is in `components/page-builder/style-fields/` and `style-settings.tsx`. The gating rules (hide flex-child when parent isn't flex) are in `visibility.ts`. Treat this file as the configuration table; the rendering lives elsewhere.

Natural next reads: `style-fields/length-props.ts` (to see what `lengthProp` returns) and `property-field.tsx` (for the `FlexPresetField` that drives the Auto/Fill/Hug preset).
