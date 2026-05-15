# Property Field Rendering Flow

## File structure

```
style-fields/
├── property-field.tsx          # Entry point — dispatches by property type
├── property-field-context.tsx  # Context that breaks the circular import
├── property-row.tsx            # Label + actions row wrapper
├── composite-field.tsx         # Composite properties (margin, padding, gap, etc.)
├── stack-field.tsx             # Stack properties (background, box-shadow, etc.)
├── ─ (leaf field components)   # NumberField, ColorField, SelectField, etc.
```

## Entry: `property-field.tsx`

`PropertyField` is the dispatcher. Given any GrapesJS property, it inspects `property.getType()` and picks the matching field component:

```
type = property.getType()

type === "length" | "number" | "integer" | "slider"  →  NumberField
type === "color"                                      →  ColorField
type === "select"                                     →  SelectField
type === "radio"                                      →  RadioField
type === "file"                                       →  FileField
type === "stack"                                      →  StackField
type === "composite"                                  →  CompositeField
default                                               →  BaseField
```

It wraps the chosen field in a `PropertyRow` (label row + field area) and surrounds everything in `PropertyFieldProvider` context:

```tsx
<PropertyFieldProvider value={(p) => <PropertyField property={p} />}>
  <PropertyRow property={property} layout={layout}>
    {field}
  </PropertyRow>
</PropertyFieldProvider>
```

The provider injects a **render function** into React context — this is what lets child components render new `PropertyField` instances without directly importing `PropertyField` (avoiding circular imports).

## Label row: `property-row.tsx`

`PropertyRow` renders:

```
┌─────────────────────────────────────┐
│ [label text]   [↺ clear]  [+ add]  │  ← label row (flex items-center)
│ [     field content area      ]     │  ← children slot
└─────────────────────────────────────┘
```

The [+ add] button only appears when `property.getType() === "stack"`. It calls `property.addLayer()` to prepend a new layer.

## Stack properties: `stack-field.tsx`

Used for multi-layer CSS values: `background`, `box-shadow`, `text-shadow`, `transition`, `transform`, `filter`, `backdrop-filter`.

```
StackField
├── if layers.length > 0
│   └── div (border + padding container)
│       └── for each layer → LayerRow
│
LayerRow
├── div (clickable row)
│   ├── [layer label]           ← click to select, opens Popover
│   └── [trash icon]            ← removes layer
├── PopoverContent
│   └── for each sub-property
│       └── renderProperty(p)   ← renders PropertyField via context
```

`LayerRow` uses `usePropertyRenderer()` from context to render sub-properties (e.g., `background-image-sub`, `background-repeat-sub`) inside the popover. This is where the context pattern kicks in — `LayerRow` never imports `PropertyField`.

## Composite properties: `composite-field.tsx`

Used for grouped CSS values: `margin`, `padding`, `border`, `border-radius`, `gap`, `flex`.

```
CompositeField
├── name === "margin" | "padding"  →  AllCustomField + CrossGrid (4-side grid)
├── name === "gap"                  →  AllCustomField + row/column grid
├── name === "border-radius"        →  AllCustomField + 2×2 corner grid
├── name === "flex"                 →  FlexCompositeField
│   ├── FlexPresetField (Auto / Fill / Hug / Custom radio)
│   └── if customActive → renderProperty(p) for grow / shrink / basis
└── default (generic composite)
    └── for each sub-property → renderProperty(p)
```

Like `StackField`, the generic fallback and `FlexCompositeField` use `usePropertyRenderer()` to render sub-properties without importing `PropertyField`.

## Context: `property-field-context.tsx`

```tsx
type RenderProperty = (property: Property) => React.ReactNode

// Provided at the top of every PropertyField render
<PropertyFieldProvider value={(p) => <PropertyField property={p} />}>

// Consumed by StackField / CompositeField / LayerRow / FlexCompositeField
const renderProperty = usePropertyRenderer()
```

This avoids the circular import that would occur if `property-field.tsx` imported `stack-field.tsx` and `stack-field.tsx` imported `property-field.tsx`.

## Data flow diagram

```
StyleSector
  └── PropertyField (per property)
        ├── provider: (p) => <PropertyField property={p} />
        ├── PropertyRow (label + clear + add-layer button)
        └── field (one of:)
              ├── NumberField
              ├── ColorField
              ├── SelectField
              ├── RadioField
              ├── FileField
              ├── BaseField
              ├── StackField
              │     └── LayerRow
              │           └── PopoverContent
              │                 └── renderProperty(p) → PropertyField (recursive)
              └── CompositeField
                    ├── (specialized UIs for margin/padding/gap/border-radius/flex)
                    └── generic fallback
                          └── renderProperty(p) → PropertyField (recursive)
```

Recursive calls always go through the context's `renderProperty` function, which creates a new `PropertyField` wrapped in its own `PropertyFieldProvider`. This means each level of nesting has its own provider, so the render function is always available to descendants regardless of depth.
