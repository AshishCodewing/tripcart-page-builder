# BlocksProvider — how it works, end to end

This document explains exactly what `BlocksProvider` from `@grapesjs/react`
does and how `block-manager.tsx` consumes it. It is grounded in the actual
package source (`node_modules/@grapesjs/react/dist/index.js`), not vibes.

---

## 1. The big picture

GrapesJS is a vanilla-JS page builder. It owns:

- An iframe-based **canvas** that renders your edited document.
- A handful of UI **modules** (Block Manager, Style Manager, Layer Manager,
  etc.) that render into DOM containers it controls.
- An internal **event bus** (`editor.on(...)` / `editor.off(...)`) that fires
  whenever the underlying state changes.

`@grapesjs/react` does **not** rewrite any of that. Per the official README:

> The goal of this library is not to provide UI components but simple wrappers
> around the core GrapesJS modules and let you define your own UI components
> and access easily the GrapesJS API.

So the wrapper does only two things:

1. **Tells GrapesJS "I'll take over the UI for module X"** — so GrapesJS
   stops drawing its own Block panel / Layer panel / etc.
2. **Subscribes to that module's reactive event** and **mirrors** the latest
   state into React via a render-prop.

`BlocksProvider` is the wrapper for the **Block Manager** module
(`editor.Blocks`).

---

## 2. The render-prop pattern (briefly)

```tsx
<BlocksProvider>
  {(props) => <BlockManager {...props} />}
</BlocksProvider>
```

`children` is a **function**, not JSX. The provider calls it with a fresh
`props` object every time the underlying state changes.

Why not React Context + a hook? Two reasons:

- It forces consumers to be **inside** the provider. There's no way to
  accidentally read empty defaults.
- It makes the data flow **synchronous and obvious**: provider → callback →
  UI, no intermediate hook indirection.

You'll see the same pattern repeated in every wrapper from `@grapesjs/react`:
`SelectorsProvider`, `StylesProvider`, `LayersProvider`, `TraitsProvider`,
`PagesProvider`, `BlocksProvider`, `DevicesProvider`. They all expose a
render-prop child.

---

## 3. What `BlocksProvider` actually does

Here is the compiled source, de-minified and annotated. This is the real
implementation — `node_modules/@grapesjs/react/dist/index.js` lines 129-157.

```tsx
const BlocksProvider = memo(function ({ children }) {
  const { editor } = useEditorContext()       // gets the Editor from <GjsEditor>
  const customCtx  = useCustomBlocksContext() // internal "I'm taking over" flag

  // 1) Local React state — defaults are no-ops so consumers never see undefined.
  const [state, setState] = useState(() => ({
    blocks: [],
    dragStart: () => {},
    dragStop:  () => {},
    mapCategoryBlocks: new Map(),
    Container: () => <></>,
  }))

  // 2) Subscribe to the BlockManager's "custom render" event.
  useEffect(() => {
    if (!editor) return

    const eventName = editor.Blocks.events.custom // "block:custom"

    const handler = ({ blocks, container, dragStart, dragStop }) => {
      // 3) Group blocks by category label into a Map<string, Block[]>.
      const mapCategoryBlocks = blocks.reduce((acc, block) => {
        const cat = block.getCategoryLabel()
        const list = acc.get(cat)
        if (list) list.push(block)
        else acc.set(cat, [block])
        return acc
      }, new Map())

      // 4) Push everything into React state — re-renders the children fn.
      setState({
        blocks,
        dragStart,
        dragStop,
        mapCategoryBlocks,
        Container: portalContainer(container),
      })
    }

    editor.on(eventName, handler)
    editor.Blocks.__trgCustom()  // 5) Fire once on mount to populate.

    return () => editor.off(eventName, handler)
  }, [editor])

  // 6) Tell GrapesJS we own the Blocks UI — disables the default panel.
  useEffect(() => { customCtx.setCustomBlocks(true) }, [])

  // 7) Render the user's child function with the current state.
  if (!editor) return <></>
  return typeof children === "function" ? children(state) : <></>
})
```

### Step-by-step

1. **Reads the editor from context.** `<GjsEditor>` puts the `Editor`
   instance into a React context. Every provider pulls it from there. If
   you're not inside `<GjsEditor>`, providers render nothing.

2. **Subscribes to `editor.Blocks.events.custom`** (the string `"block:custom"`).
   This event is GrapesJS's "the Block Manager wants to redraw" signal. It
   fires when:
   - A block is added (`editor.BlockManager.add(...)`)
   - A block is removed
   - A block's properties change
   - A drag starts/ends (so the UI can reflect drag state)

3. **Reshapes the payload.** GrapesJS gives you a flat array of blocks.
   The provider groups them into a `Map<categoryLabel, Block[]>` keyed by
   `block.getCategoryLabel()`. Iteration order = insertion order, which
   means category order matches the order GrapesJS first saw them.

4. **Updates React state**, which triggers your `children(state)` to
   re-render with fresh data.

5. **`__trgCustom()` is the priming call.** Without it, the provider would
   only update *after* the next mutation. Calling it forces GrapesJS to
   immediately fire `block:custom` with the current snapshot, so the UI
   isn't blank for one frame.

6. **`setCustomBlocks(true)`** — this is how the wrapper tells GrapesJS
   "don't render your default Block panel; React is doing it." Without this
   call, GrapesJS would happily render its own DOM into the (now invisible)
   default container in addition to your React UI.

7. **Calls `children(state)`.** Standard render-prop.

### What's *not* on this list

- **No polling.** It's pure event-driven.
- **No diffing.** Every event rebuilds the Map from scratch. Cheap because
  blocks are typically dozens, not thousands.
- **No memoization of the props object.** Every event creates a fresh
  `state` object. That means `useMemo`/`useCallback` based on identity
  will fire every event — usually fine, but worth knowing.

---

## 4. The state shape — `BlocksResultProps`

From `BlocksProvider.d.ts`:

```ts
type BlocksResultProps = {
  blocks: Block[]                              // flat array of all blocks
  dragStart: (block: Block, ev?: Event) => void
  dragStop:  (cancel?: boolean) => void
  Container: PortalContainerResult              // for portal-style integration
  mapCategoryBlocks: Map<string, Block[]>       // grouped by category label
}
```

What each one is for:

| Prop | What it is | When you'd use it |
|------|------------|-------------------|
| `blocks` | All registered blocks, flat. | Filtering/searching across categories. |
| `mapCategoryBlocks` | Same blocks, grouped by `getCategoryLabel()`. | Default UI: render category sections. |
| `dragStart(block, ev)` | Native handler that puts GrapesJS into "drag mode" with this block as cargo. | `onDragStart` of your tile. |
| `dragStop(cancel)` | Ends the drag. `false` = commit drop, `true` = abort. | `onDragEnd` of your tile. |
| `Container` | A portal target — the DOM element GrapesJS would have rendered its default Block panel into. | If you want to mix React + GrapesJS-rendered DOM, render into this container with `createPortal`. We don't use it. |

`block-manager.tsx` only uses three of these — the `Pick` makes the
contract explicit:

```ts
type Props = Pick<
  BlocksResultProps,
  "mapCategoryBlocks" | "dragStart" | "dragStop"
>
```

---

## 5. The `Block` object

Each item in `mapCategoryBlocks.get(cat)` is a GrapesJS `Block` instance.
Methods we call:

| Method | Returns | Notes |
|--------|---------|-------|
| `getId()` | `string` | Stable, unique. Use as React key. |
| `getLabel()` | `string` | Human-readable name. |
| `getMedia()` | `string` | **HTML markup** for the icon (svg, img, etc.). |
| `getCategoryLabel()` | `string` | The grouping key. Empty string if uncategorized. |
| `getContent()` | `string \| ComponentDefinition` | What gets dropped onto the canvas. |
| `getDragDef()` | `ComponentDefinition` | Same as `getContent`, normalized to a Component definition. |

Block-level props you set when registering: `label`, `content`, `media`,
`category`, `activate`, `select`, `resetId`, `disable`, `onClick`,
`attributes`. These come from `editor.BlockManager.add(id, def)`.

---

## 6. The drag handshake — why it matters

This is the trickiest concept in the whole system, so it gets its own section.

### The mismatch

- Your block tile is a React `<button>` in the **outer document**.
- The drop target is the GrapesJS canvas — an `<iframe>` with its own
  document, layout system, hit-testing, and drop indicators.

HTML5 drag-and-drop alone won't bridge those two. You'd need cross-frame
event coordination, drop-zone highlighting, snap-to-grid, etc. — all of
which GrapesJS already implements internally for its own dragging.

### How the wrapper bridges it

When you call `dragStart(block, ev.nativeEvent)`:

1. GrapesJS records "we're now dragging this block" in its internal state.
2. It attaches its own listeners to the iframe document (`dragover`,
   `dragleave`, `drop`).
3. As the user moves over the canvas, GrapesJS computes the drop position,
   shows the green insertion indicator, and tracks the candidate parent.
4. On drop, it inserts the block's `content` (the HTML / ComponentDefinition)
   at the computed position.

When you call `dragStop(false)`:

1. GrapesJS finalizes the drop (if one happened) or cleans up if the user
   dropped outside the canvas.
2. It clears its internal "dragging" state.
3. The next `block:custom` event fires, your provider re-renders, life
   continues.

`dragStop(true)` aborts — the canvas reverts and the drop is discarded.

### Why we pass `ev.nativeEvent`

`onDragStart` in React receives a `SyntheticEvent`. GrapesJS' `dragStart`
expects a real DOM `Event` so it can read `dataTransfer`, `clientX/Y`, etc.
`ev.nativeEvent` is the underlying browser event.

### Why `draggable` on the button

Browsers only fire `dragstart`/`dragend` on elements with the `draggable`
attribute. Without it, the user can press and drag but no drag events
fire — and GrapesJS never knows the drag started.

### Why we *don't* preventDefault or set dataTransfer

GrapesJS handles all of that internally once `dragStart` is called. Setting
`dataTransfer.setData(...)` ourselves would interfere.

---

## 7. Walking through `block-manager.tsx`

```tsx
type Props = Pick<
  BlocksResultProps,
  "mapCategoryBlocks" | "dragStart" | "dragStop"
>
```

We narrow the prop type to only what we need. This is documentation —
anyone reading the type sees exactly what data the component touches.

```tsx
const categories = React.useMemo(
  () => Array.from(mapCategoryBlocks),
  [mapCategoryBlocks]
)
```

`Map.entries()` (which `Array.from(map)` consumes) produces a fresh
iterator each call. Wrapping the conversion in `useMemo` keyed on the
`Map` reference means we only re-allocate the array when the provider
hands us a new Map. (The provider creates a new Map every event, so this
isn't a huge win, but it's the right hygiene.)

```tsx
if (categories.length === 0) return <BlockManagerEmpty />
```

Empty state. This happens if no plugins are loaded or the project hasn't
registered any blocks yet.

```tsx
<ScrollArea className="h-full">
```

The right sidebar has a fixed height (`h-[calc(100svh-3rem)]`). Without a
scroll container the block list would overflow the sidebar. `ScrollArea`
is shadcn's wrapper around Radix's scroll-area primitive — same flex
behavior as `overflow-auto`, but with styled scrollbars.

```tsx
{categories.map(([category, blocks]) => (
  <section key={category || "uncategorized"}>
    <header className="border-y bg-muted/40 ...">
      {category || "Other"}
    </header>
```

`category` is the string from `block.getCategoryLabel()`. For blocks
registered without a category, it's `""`. We fall back to `"Other"` for
display and `"uncategorized"` as the React key (keys must be non-empty).

```tsx
<button
  key={block.getId()}
  type="button"
  draggable
```

`type="button"` so it doesn't submit the surrounding `<form>` in
`editor-shell.tsx` (the form wraps the whole editor for the Save server
action). `draggable` enables HTML5 drag events.

```tsx
  onDragStart={(ev) => dragStart(block, ev.nativeEvent)}
  onDragEnd={() => dragStop(false)}
```

The drag handshake from §6. **Always** call `dragStop` on `dragEnd` —
even if the user dropped outside the canvas. Otherwise GrapesJS thinks
a drag is still in flight and you get sticky drop indicators.

```tsx
  className={cn(
    "flex flex-col items-center gap-1.5 rounded-md border bg-card px-2 py-3 text-card-foreground transition-colors",
    "hover:border-ring hover:bg-primary/5",
    "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
    "cursor-grab active:cursor-grabbing"
  )}
>
```

Semantic shadcn tokens (`bg-card`, `border-ring`, `bg-primary/5`) so it
adapts to dark mode without `dark:` overrides. `cursor-grab`/
`active:cursor-grabbing` is the visual cue that this is draggable —
small but it makes a real difference in perceived quality.

```tsx
  <span
    aria-hidden
    className="flex size-10 items-center justify-center text-muted-foreground [&>svg]:size-8"
    dangerouslySetInnerHTML={{ __html: block.getMedia() ?? "" }}
  />
```

`getMedia()` returns an **HTML string** (the block's icon, typically inline
SVG or `<img>`). React doesn't render strings as HTML by default — that's
why `dangerouslySetInnerHTML` is the only way.

**Is this safe?** Yes, because:
1. Block media comes from blocks *we* register (or from plugins we control,
   like `grapesjs-blocks-basic`).
2. There is no path where end-user input becomes block media.

If your app ever lets users contribute their own blocks, you'd need to
sanitize first.

The `[&>svg]:size-8` selector forces any inline `<svg>` inside this
wrapper to render at `size-8`, ignoring whatever dimensions the source
markup specifies. Plugins ship with inconsistent SVG sizes; this normalizes
them.

```tsx
  <span className="line-clamp-1 max-w-full text-xs">
    {block.getLabel()}
  </span>
```

`line-clamp-1` truncates long labels to one line with an ellipsis. The
full label is in the `title` attribute on the button for hover tooltips.

---

## 8. Where do blocks actually come from?

`mapCategoryBlocks` is empty unless something has called
`editor.BlockManager.add(id, def)`. Three common sources:

### a) Plugins — what we use today

In `editor-shell.tsx`:

```ts
import gjsBlocksBasic from "grapesjs-blocks-basic"

const gjsOptions: EditorConfig = {
  plugins: [gjsBlocksBasic],
  // ...
}
```

`grapesjs-blocks-basic` registers ~10 blocks (Section, Text, Image, Link,
Columns, etc.) under category `"Basic"`.

### b) Manual registration — for custom blocks

```ts
const onEditor = (editor: Editor) => {
  editor.BlockManager.add("hero-banner", {
    label: "Hero Banner",
    category: "TripCart",
    media: '<svg>…</svg>',
    content: '<section class="hero">…</section>',
  })
}
```

Call this from your `onEditor` callback in `<GjsEditor onEditor={...}>`.

### c) Init options — equivalent to manual

```ts
const gjsOptions: EditorConfig = {
  blockManager: {
    blocks: [
      { id: "hero-banner", label: "Hero Banner", /* … */ },
    ],
  },
}
```

Functionally identical to (b), just declared up front.

In all three cases, after the call, `block:custom` fires, the provider
rebuilds `mapCategoryBlocks`, and your UI re-renders.

---

## 9. Lifecycle — when does the BlockManager UI re-render?

The provider re-fires `children(state)` on every `block:custom` event.
That event fires on:

| Action | Event | Consequence |
|--------|-------|-------------|
| Editor mounts | (initial `__trgCustom()`) | First render with current blocks. |
| `BlockManager.add()` | `block:add` → `block:custom` | New block appears. |
| `BlockManager.remove()` | `block:remove` → `block:custom` | Block disappears. |
| `block.set("category", "X")` | `block:update` → `block:custom` | Block moves between groups. |
| `dragStart` / `dragStop` | `block:drag*` → `block:custom` | UI can reflect drag state. |
| Editor unmounts | (cleanup) | Effect cleanup unsubscribes. |

If you need finer-grained subscriptions (e.g. only re-render on `block:add`),
drop into `useEditor()` and listen yourself — but the provider's
"redraw the whole panel" model is intentionally simple.

---

## 10. Common gotchas

### "My blocks tab is empty"
Check that a plugin is registered (`plugins: [gjsBlocksBasic]`) or that
you're calling `editor.BlockManager.add(...)` somewhere. Without
registrations, `mapCategoryBlocks` is an empty Map.

### "The drag indicator doesn't show / drop doesn't work"
You forgot one of:
- `draggable` attribute on the tile element
- `dragStart(block, ev.nativeEvent)` on `onDragStart`
- `dragStop(false)` on `onDragEnd`

All three are required. The most common omission is forgetting
`ev.nativeEvent` and passing the synthetic React event, which makes
GrapesJS's `dataTransfer` reads silently fail.

### "Block media renders as escaped HTML text"
You forgot `dangerouslySetInnerHTML`. React escapes string children by
default. There's no other way to render an HTML string from a third-party
source.

### "I see two block panels — mine and GrapesJS's default"
The wrapper calls `setCustomBlocks(true)` automatically. But if you
configure `panels` in `gjsOptions` to include the default Block panel,
GrapesJS will still render its old chrome. We fixed this in
`editor-shell.tsx` with `panels: { defaults: [] }`.

### "My provider works once but never updates"
You're probably mutating a block instead of calling `block.set(...)`.
Direct mutations don't fire events. Always go through the API.

### "The `Container` prop is a function — what do I do with it?"
Ignore it for fully-custom UI like ours. It's there for hybrid setups
where you want GrapesJS to render its default panel into a React-managed
DOM node. You'd use `createPortal(<DefaultBlockUI />, props.Container())`.
We don't need it.

---

## 11. Extending the block manager

A few common extensions, with the pattern for each:

### Search/filter

The provider only gives you data — filtering is your job. Use the flat
`blocks` array if you want filtering across categories:

```tsx
function BlockManager({ blocks, dragStart, dragStop }) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(
    () => blocks.filter((b) =>
      b.getLabel().toLowerCase().includes(query.toLowerCase())
    ),
    [blocks, query]
  )
  // …
}
```

### Click-to-insert (in addition to drag)

Drop into `useEditor()` and append the block content to the selected
component (or the wrapper):

```tsx
import { useEditor } from "@grapesjs/react"

const editor = useEditor()
// …
onClick={() => {
  const target = editor.getSelected() ?? editor.getWrapper()
  target?.append(block.getContent())
}}
```

### Custom category order

`mapCategoryBlocks` preserves insertion order (it's a `Map`). To force a
specific order, sort:

```tsx
const ORDER = ["Basic", "Layout", "TripCart", "Forms"]
const sorted = [...mapCategoryBlocks].sort(
  ([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b)
)
```

### Hide a category entirely

Filter before render:

```tsx
const visible = [...mapCategoryBlocks].filter(([cat]) => cat !== "Hidden")
```

### Disable a block conditionally

Set `disable: true` on the block when registering, or call
`block.set("disable", true)` later. The provider will re-fire and your UI
sees `block.get("disable")`. You can render disabled tiles greyed out.

---

## 12. Mental model summary

Three things to remember:

1. **`BlocksProvider` is a thin event-to-React adapter.** It subscribes to
   `block:custom`, re-shapes the payload, and pushes it through a
   render-prop. No magic, no proxies, no hooks-into-Vue/whatever.

2. **The drag handshake is a contract you must honor.**
   `draggable` + `dragStart(block, nativeEvent)` + `dragStop(false)`.
   Miss any of those and drag-and-drop breaks silently.

3. **You're not rendering React inside the canvas.** The canvas is
   GrapesJS's iframe — alien territory. Everything in `block-manager.tsx`
   renders *outside* the canvas, and the bridge between them is the drag
   handshake plus the provider's event subscription. Same applies to
   every other `*Provider` in `@grapesjs/react`.

If you internalize those three, the rest of the wrappers
(`SelectorsProvider`, `StylesProvider`, `LayersProvider`, etc.) are just
the same pattern wired to a different module's events.
