# Custom React UI — gaps you must fill yourself

## Why this exists

GrapesJS ships with a vanilla-JS UI that manages its own DOM. When you use
`@grapesjs/react` providers (`StylesProvider`, `TraitsProvider`, etc.), you call
`traitManager: { custom: true }` (the provider sets this automatically) and GrapesJS
stops managing its own panel DOM entirely.

The tradeoff: **you inherit responsibilities that GrapesJS was silently handling.**
The providers only re-render on their module's own event (`style:custom`,
`trait:custom`, etc.). Canvas selection is a separate event — the providers don't
subscribe to it. This leaves holes you must patch manually.

---

## The pattern

For any panel that should show/hide based on canvas selection:

```ts
// 1. Read actual current state at mount — don't assume "nothing selected".
const [hasTarget, setHasTarget] = React.useState(
  () => editor.StyleManager.getSelected() != null
)

// 2. Subscribe to the canvas selection events the provider misses.
React.useEffect(() => {
  const refresh = () => {
    setHasTarget(editor.StyleManager.getSelected() != null)
  }
  editor.on("style:target", refresh)
  editor.on("component:selected", refresh)
  editor.on("component:deselected", refresh)
  return () => {
    editor.off("style:target", refresh)
    editor.off("component:selected", refresh)
    editor.off("component:deselected", refresh)
  }
}, [editor])

// 3. Gate the panel UI on hasTarget.
if (!hasTarget) return <p>Select a component to edit styles.</p>
```

### Why lazy `useState(() => ...)`

Without the `() =>` initializer function, the expression runs on every render.
More critically, without reading the current GrapesJS state at mount time, if a
component was already selected before the panel renders (e.g. panel was hidden
then shown), `hasTarget` starts as `false` and incorrectly shows the placeholder
until the next selection event fires.

### Why three events

| Event | When it fires |
|---|---|
| `style:target` | Style Manager target changes (e.g. CSS selector switch) |
| `component:selected` | User clicks a component on the canvas |
| `component:deselected` | User clicks empty canvas / presses Escape |

The provider only fires on `style:custom`. That event does not fire when the
selection changes — only when the Style Manager's container itself changes (rare).
All three events above are needed to stay in sync.

---

## Where this is applied

### `StyleManagerInner` (`managers/style-manager.tsx`)

```ts
const [hasTarget, setHasTarget] = React.useState<boolean>(
  () => editor.StyleManager.getSelected() != null
)
const [openId, setOpenId] = React.useState<string | null>(null)

React.useEffect(() => {
  const refresh = () => {
    setHasTarget(editor.StyleManager.getSelected() != null)
    setOpenId(null)   // ← collapse all sectors on selection change
  }
  editor.on("style:target", refresh)
  editor.on("component:selected", refresh)
  editor.on("component:deselected", refresh)
  return () => {
    editor.off("style:target", refresh)
    editor.off("component:selected", refresh)
    editor.off("component:deselected", refresh)
  }
}, [editor])
```

`setOpenId(null)` collapses the open sector accordion whenever the target changes,
so you always start fresh on a new component rather than seeing a stale open state.

### `TraitManager` (`managers/trait-manager.tsx`)

Same pattern, different GrapesJS API call:

```ts
const [hasTarget, setHasTarget] = React.useState(
  () => editor.Traits.getComponent() != null
)

React.useEffect(() => {
  const refresh = () => setHasTarget(editor.Traits.getComponent() != null)
  editor.on("trait:select", refresh)
  return () => editor.off("trait:select", refresh)
}, [editor])
```

`trait:select` fires whenever `TraitsProvider` gets a new component — it covers
both selection and deselection.

---

## Rule of thumb

Any panel that:
- Uses a `*Provider` from `@grapesjs/react`
- Should be visible only when a component is selected
- Has state that should reset between selections

…needs this pattern. The provider handles reactive data updates; you handle
show/hide and reset.
