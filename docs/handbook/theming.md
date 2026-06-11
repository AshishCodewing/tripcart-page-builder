# Theming

Each tenant has a brand **Theme**: colors, typography, spacing, borders, shadows,
and default element/component styles. The theme is kept *separate* from page content
and layered on as CSS variables.

## The core idea

A theme is a JSON document. It compiles to a set of **CSS custom properties** named
`--tc--preset--<category>--<slug>` (plus a `--tc--custom--*` escape hatch), along
with a few default style rules (body, headings, buttons, etc.).

Authored content references those variables (e.g. a heading's color is
`var(--tc--preset--color--primary)`), so changing the theme restyles every page that
uses the tokens — without touching any page's saved JSON.

```
Theme JSON  ──compile──▶  :root { --tc--preset--color--primary: …; … }
                          body, h1…h6, button { … }   ← element/component defaults
```

## Why content and theme stay separate

If the theme were baked into each page blob, every theme edit would require
re-saving every page, and stale snapshots would fight the live theme in the cascade.
Instead, theme rules are marked **protected** and stripped from page JSON on every
save. The theme is injected independently:

- **In the editor** — `designSystemPlugin` writes the compiled `:root` + defaults
  into the canvas iframe, and re-injects whenever the theme changes.
- **On preview/publish** — the preview layout links a cached, versioned stylesheet
  (`/api/preview/theme/[tenantId]/[version]/theme.css`).
- **In the outer admin UI** — `useApplyThemeVars` mirrors the tokens onto the
  document root so swatches/popovers resolve the same variables.

## Tokens & presets

Token *values* are built on [Open Props](https://open-props.style) (e.g.
`hsl(var(--blue-6-hsl))`, `var(--size-3)`). Any surface rendering authored content
must load the Open Props CSS — the editor canvas does this via `CANVAS_STYLE_URLS`,
and published pages must serve `/vendor/open-props-*.min.css` too.

**Presets** are pre-built token sets a user can apply with one click — color presets
(Blue, Violet, Rose, …) and typography presets (System Sans, Editorial Display, …).
Applying a preset merges its tokens into the theme.

## Editing flow

The theme admin UI (`app/admin/(shell)/tenants/[id]/theme/`) edits a client-side
`themeStore`. Every change cascades live to the canvas and the outer UI through store
subscriptions. Saving calls `updateTenantTheme`, which validates with Zod, writes the
JSON, and **bumps `themeVersion`** — that version is the cache key in the stylesheet
URL, so previews pick up the change without any cache purge.

## The bundled default

A tenant with an empty theme (`{}`) falls back to the bundled `defaultTheme`
(`lib/tokens/`) — a blue + system-sans starting point.

For the document schema, the compile output, the store API, and the versioned-CSS
cache contract, see [theming.technical.md](theming.technical.md).
