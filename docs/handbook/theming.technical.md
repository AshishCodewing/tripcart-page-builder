# Theming — technical

Read [theming.md](theming.md) first. This maps the code.

## Files

| File | Responsibility |
|---|---|
| `lib/theme/schema.ts` | TypeScript types: `Theme = { version, settings: TokenRegistry, styles?, custom? }`. `Token = { slug, name, value, fluid? }`. `StyleRef` resolution scheme. |
| `lib/theme/schema.zod.ts` | Runtime Zod validator (mirrors the TS types). Used on the **write** path only; reads trust TS. |
| `lib/theme/compile.ts` | `compileTheme(theme) → { rootVars, rules }`; `compiledThemeToCss()` serializes to a CSS string. Owns the variable naming scheme. |
| `lib/theme/presets.ts` | `COLOR_PRESETS`, `TYPOGRAPHY_PRESETS`, `Preset` type. |
| `lib/theme/theme-store.ts` | Client store (manual subscribe, not Zustand): `setTheme`, `setToken`, `applyPreset`, `detectActivePresets`, `resetTheme`, `subscribe`. |
| `lib/tokens/index.ts` | `defaultTheme`, `defaultActivePresetId`, `tokensFromStored()` (rehydrate from a stored `:root` rule). Open Props value mapping. |
| `lib/plugins/design-system-plugin.ts` | Injects compiled theme into the **canvas**; marks rules `protected`; re-injects on store change; hydrates store from a persisted `:root` on load. |
| `hooks/use-apply-theme-vars.ts` | Mirrors tokens onto `document.documentElement` for the outer UI; cleans up on unmount. |
| `hooks/use-theme.ts` | `useTheme()` (full) + `useThemeSelector(fn)` (granular, ref-equality cached). |
| `app/api/preview/theme/[tenantId]/[version]/theme.css/route.ts` | Serves compiled theme CSS, `cache-control: immutable`. |
| `lib/cms/tenants.ts` / `tenant-actions.ts` | `findTenantTheme` / `getTenantTheme` (read, stored row layered over `defaultTheme` via `lib/theme/merge-defaults.ts`); `updateTenantTheme` (Zod validate, write, bump `themeVersion`, invalidate tags). |
| `lib/theme/stylesheet-key.ts` | `themeStylesheetKey(theme)` — content hash of the compiled CSS, the preview stylesheet's cache key. |

## The variable naming scheme (compile.ts)

- Preset tokens → `--tc--preset--<category>--<slug>`
  (categories: `color`, `font-family`, `font-size`, `font-weight`, `line-height`,
  `letter-spacing`, `spacing`, `radius`, `border-width`, `border-style`, `shadow`).
- Custom tree → `--tc--custom--<path>--<segments>` (auto-kebab-cased).
- `StyleRef` strings resolve: `var:preset|color|primary` →
  `var(--tc--preset--color--primary)`; `var:custom|…`; raw CSS passes through.

`compileTheme` output:
- `rootVars` — the `:root` declaration map.
- `rules` — scoped selectors for `styles.elements.*` (e.g. `heading` → `h1,…,h6`;
  `button` → `.tc-element-button` only, the opt-in badge blocks wear — WP's
  `.wp-element-button`; raw `<button>`s are never themed), including `:hover/:focus/...`
  pseudo variants suffixed onto every selector in the list. An element's `variations.<slug>`
  compiles to `<selector>.is-style-<slug>` (plus pseudos), emitted after the base rule and
  one class heavier, so a block only toggles the class — see `lib/plugins/button`. The root
  style block merges onto `body`.
- `styles.components.<type>` — per-block styles (WP's `styles.blocks.<name>`). The block
  declares a `StyleSurface` (`lib/theme/style-surfaces.ts`: root + named `parts`, each with a
  real-specificity selector, allowed style groups and allowed `states` suffixes). Top-level
  declarations land on the root selector, `parts.<name>` on that part's selector, `states`
  keys are appended verbatim (`tc-tabs [role="tab"][aria-selected="true"]`). The schema
  rejects undeclared parts, states and groups on write; a type with no surface is accepted
  and compiles to nothing. First surface: `lib/plugins/interactive/tabs.surface.ts`.

## Canvas injection (design-system-plugin.ts)

On load: read any persisted `:root` rule → `tokensFromStored` hydrates the store →
re-inject so the rule exists and is protected. Then `subscribe` to the store and
re-inject on every change. Injection writes `:root` + each compiled rule via
`CssComposer.setRule(...)`, marks them `protected: true`, and tracks written
selectors so stale ones are cleared on the next compile.

**Protected** is the linchpin: `filterProtectedStyles` (storage adapter) strips these
on save, so the theme is never duplicated into page blobs.

## Content-keyed CSS cache contract

1. The preview layout resolves the tenant theme (`findTenantTheme`), compiles it, and
   hashes the CSS (`themeStylesheetKey`).
2. It emits `<link href=".../theme/[tenantId]/<hash>/theme.css">`.
3. The route serves compiled CSS as `immutable`. Anything that changes the compiled CSS —
   a tenant save, a compiler change, a change to the bundled defaults — changes the hash,
   so the browser/CDN fetches fresh; the old URL is harmlessly abandoned. No purge needed.

The `[version]` segment is a cache key only — the route always serves the *current*
theme. `Tenant.themeVersion` still increments on save but no longer drives the URL: keyed
on it alone, a compiler or defaults change left browsers on stale CSS until the tenant
happened to save (seen 2026-09-03: preview kept the removed `button` tag rule).

## Store mechanics (theme-store.ts)

Snapshot is `{ theme, activePresetId }`. Mutations rebuild only the touched category
subtree (reference-preserving) so `useThemeSelector` subscribers skip unrelated
re-renders. `detectActivePresets(presets)` recomputes which preset (if any) matches
the current tokens after a server round-trip.

## End-to-end flow

DB `Tenant.theme` → `getTenantTheme` layers it over `defaultTheme`
(`lib/theme/merge-defaults.ts`: objects recurse, stored keys win, token arrays replace
wholesale — so a default added later still reaches every tenant, and a tenant can
override but never delete a default key) → (editor) `themeStore.setTheme(tenantTheme)`
in `editor-shell.tsx` → `designSystemPlugin` injects canvas CSS + `useApplyThemeVars`
mirrors to document root. Edit a token → store emits → both layers update. Save → `updateTenantTheme`
(Zod + version bump). Render → preview layout links the versioned stylesheet;
authored content's `var(--tc--preset--*)` references resolve against it.

## Gotchas

- Open Props CSS must be loaded wherever authored content renders (canvas + publish),
  or every token resolves to nothing.
- Fluid font sizes compile to `clamp(min, value, max)` from the token's `fluid` field.
- Don't write theme rules into page JSON — always go through the store/plugin so they
  stay protected.
