# Tailwind + GrapesJS Blocks: Architecture Guide

## Styling Strategy

Two distinct styling layers coexist on every public page:

| Layer | Technology | Scope |
|---|---|---|
| Shell (header, footer, nav, UI chrome) | Tailwind v4 | Statically known at build time |
| Custom blocks (page builder content) | Vanilla CSS + Open Props | Stored in DB, loaded at runtime |

This separation cleanly solves the Tailwind compilation problem: since blocks use vanilla CSS, Tailwind never needs to see or compile block styles. Tailwind only handles the shell, which is static and known at build time — exactly what it is designed for.

---

## 1. Why Vanilla CSS + Open Props for Blocks

### The Tailwind Compilation Problem (and Why We Sidestep It)

Tailwind v4 is a **build-time static analysis tool** — it scans source files for class names and generates only the CSS those classes need. If Tailwind utility classes were stored in a database as JSON strings, Tailwind would never see them and they would get purged at build time. Solving this requires runtime workarounds (Twind, UnoCSS, pre-generation at save time).

By writing blocks in **vanilla CSS**, this problem does not exist. CSS is inert text — it can be stored in a database and injected into a `<style>` tag at render time with no compilation step whatsoever.

### Open Props

[Open Props](https://open-props.style) is a collection of CSS custom properties that provides a consistent design token system:

```css
/* Available globally once Open Props is loaded */
--size-1: .25rem;
--font-size-fluid-1: clamp(1rem, 2vw, 1.5rem);
--shadow-2: 0 1px 2px hsl(220 3% 15% / 20%), ...;
--radius-2: .5rem;
--color-red-5: oklch(62.8% 0.25 29);
```

Block authors write vanilla CSS against these tokens. Open Props is loaded as a single CSS file on every public page.

---

## 2. The Preflight Conflict

Tailwind ships with **Preflight** — a CSS reset applied globally via element selectors. This affects every element on the page, including block content:

```css
/* Tailwind Preflight resets these globally */
h1, h2, h3, h4, h5, h6 { font-size: inherit; font-weight: inherit; }
p  { margin: 0; }
ul, ol { list-style: none; margin: 0; padding: 0; }
img { display: block; }
```

Block authors writing vanilla CSS expect browser-like defaults (bold headings, paragraph margins, list bullets). Preflight removes those defaults before block CSS runs.

### Fix: Scope a baseline reset to the block content wrapper

Wrap all block content in a `.block-content` class and restore browser-like defaults inside it:

```css
/* app/globals.css */
.block-content {
  h1 { font-size: 2em; font-weight: bold; }
  h2 { font-size: 1.5em; font-weight: bold; }
  h3 { font-size: 1.17em; font-weight: bold; }
  h4 { font-size: 1em; font-weight: bold; }
  p  { margin-block: 1em; }
  ul { list-style: disc; padding-left: 2em; }
  ol { list-style: decimal; padding-left: 2em; }
  img { display: revert; }
}
```

Preflight continues to work normally for shell components. Blocks inside `.block-content` get a predictable baseline. This is the same approach used by rich text editors (TipTap's `.prose`, Quill's `.ql-editor`).

---

## 3. GrapesJS JSON Storage Format

GrapesJS stores two separate things: the **component tree** (HTML structure) and the **CSS rules** (styles). For vanilla CSS blocks, the `styles` field carries all the weight.

### Component tree (structure only, no Tailwind classes)

```json
{
  "type": "wrapper",
  "components": [
    {
      "tagName": "section",
      "attributes": { "id": "hero", "class": "hero-block" },
      "components": [
        {
          "tagName": "h1",
          "attributes": { "class": "hero-block__title" },
          "content": "Hello World"
        },
        {
          "tagName": "p",
          "attributes": { "class": "hero-block__subtitle" },
          "content": "Subheading text"
        }
      ]
    }
  ]
}
```

### CSS rules (vanilla CSS using Open Props tokens)

```json
[
  {
    "selectors": [".hero-block"],
    "style": {
      "display": "flex",
      "flex-direction": "column",
      "align-items": "center",
      "padding-block": "var(--size-10)",
      "gap": "var(--size-4)",
      "background-color": "var(--color-blue-0)"
    }
  },
  {
    "selectors": [".hero-block__title"],
    "style": {
      "font-size": "var(--font-size-fluid-3)",
      "font-weight": "var(--font-weight-9)",
      "color": "var(--color-blue-9)"
    }
  }
]
```

GrapesJS's Style Manager writes styles in this format natively. No extra transformation needed.

---

## 4. Database Schema

```sql
-- Individual reusable blocks (the block library)
CREATE TABLE blocks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT,           -- 'hero', 'pricing', 'testimonial', etc.
  thumbnail   TEXT,           -- S3/Blob URL for preview image
  component   JSONB NOT NULL, -- GrapesJS component tree (structure + class names)
  styles      JSONB,          -- GrapesJS CSS rules array (vanilla CSS using Open Props)
  tags        TEXT[],
  is_public   BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Published pages (assembled from blocks)
CREATE TABLE pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id),
  slug          TEXT UNIQUE NOT NULL,
  title         TEXT,
  components    JSONB NOT NULL, -- full GrapesJS page state (assembled component tree)
  styles        JSONB,          -- all CSS rules for the page (merged from all blocks)
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_blocks_category ON blocks(category);
CREATE INDEX idx_blocks_tags ON blocks USING GIN(tags);
CREATE INDEX idx_pages_slug ON pages(slug);
```

> The `tw_classes TEXT[]` column from earlier drafts is no longer needed — blocks do not use Tailwind classes, so there is nothing to extract or pre-generate.

### On-Demand Block Loading

The sidebar loads block metadata only:

```sql
SELECT id, name, thumbnail, category FROM blocks WHERE category = $1
```

The `component` and `styles` JSONB columns are fetched only when a block is dragged into the canvas.

---

## 5. GrapesJS JSON → React → SSR

### Rendering the Component Tree

```tsx
// lib/renderer.tsx
import React from "react"

type GrapesNode = {
  tagName?: string
  type?: string
  attributes?: Record<string, string>
  components?: GrapesNode[]
  content?: string
}

export function renderNode(node: GrapesNode): React.ReactNode {
  const tag = node.tagName ?? "div"
  const children =
    node.content ??
    node.components?.map((child, i) => (
      <React.Fragment key={i}>{renderNode(child)}</React.Fragment>
    ))

  return React.createElement(tag, node.attributes ?? {}, children)
}
```

Note: `classes` is no longer spread as a `className` prop — block styles are applied via the CSS rules in `styles` JSONB targeting the class names already present in `attributes.class`.

### Converting GrapesJS CSS Rules to a Style String

```ts
// lib/styles.ts
type GrapesRule = {
  selectors: string[]
  style: Record<string, string>
}

export function rulesToCss(rules: GrapesRule[]): string {
  return rules
    .map((rule) => {
      const selector = rule.selectors.join(", ")
      const declarations = Object.entries(rule.style)
        .map(([prop, val]) => `  ${prop}: ${val};`)
        .join("\n")
      return `${selector} {\n${declarations}\n}`
    })
    .join("\n\n")
}
```

### Next.js Server Component

```tsx
// app/p/[slug]/page.tsx
import { db } from "@/lib/db"
import { renderNode } from "@/lib/renderer"
import { rulesToCss } from "@/lib/styles"

export default async function PublishedPage({ params }) {
  const page = await db.page.findUnique({ where: { slug: params.slug } })

  const css = rulesToCss(page.styles ?? [])

  return (
    <>
      <style>{css}</style>
      <div className="block-content">
        {renderNode(page.components)}
      </div>
    </>
  )
}
```

No Twind, no runtime compilation. The CSS is plain text injected into a `<style>` tag. Next.js SSR handles the rest.

---

## 6. The Full Rendering Pipeline

```
DB (JSONB)
    │
    ├── components JSONB ──► renderNode() ──► React element tree
    │
    └── styles JSONB ───────► rulesToCss() ──► <style> tag
                                    │
                                    ▼
                         Next.js SSR renders complete HTML
                         (Open Props variables resolve in browser)
                                    │
                                    ▼
                         Browser loads Open Props CDN link
                         CSS variables resolve, page renders correctly
```

### Editor Canvas (GrapesJS)

The GrapesJS canvas iframe needs Open Props available too. Inject it via GrapesJS canvas styles config:

```ts
const editor = grapesjs.init({
  canvas: {
    styles: [
      "https://unpkg.com/open-props/open-props.min.css",
    ],
  },
})
```

The canvas also needs the `.block-content` baseline reset injected the same way so the editor preview matches the public page exactly.

---

## 7. Summary

| Concern | Decision |
|---|---|
| Shell components (header, footer, UI chrome) | Tailwind v4, statically compiled at build time |
| Custom blocks (page builder content) | Vanilla CSS + Open Props, stored as JSONB |
| Tailwind compilation for blocks | Not needed — vanilla CSS requires no compilation |
| Open Props on public pages | Loaded via CDN link in the page `<head>` |
| Tailwind Preflight conflict | Countered with `.block-content` baseline reset in `globals.css` |
| GrapesJS JSON → React | Recursive `renderNode()` + `rulesToCss()` |
| SSR | CSS string injected into `<style>` tag, no runtime tooling |
| Editor canvas preview | Open Props + `.block-content` reset injected via `canvas.styles` config |

### Key Properties of This Approach

- **No runtime CSS tooling** — vanilla CSS needs no compilation step, no Twind, no JIT engine
- **What you store is what you serve** — the `styles` JSONB is directly serialized to a `<style>` tag
- **Editor matches public page** — both load Open Props and the same `.block-content` baseline reset
- **Tailwind stays in its lane** — only applied to statically-known shell components, compiled at build time as intended
