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
| `lib/cms/tenants.ts` / `tenant-actions.ts` | `getTenantTheme` (read, `{}`→`defaultTheme`); `updateTenantTheme` (Zod validate, write, bump `themeVersion`, invalidate tags). |

## The variable naming scheme (compile.ts)

- Preset tokens → `--tc--preset--<category>--<slug>`
  (categories: `color`, `font-family`, `font-size`, `font-weight`, `line-height`,
  `letter-spacing`, `spacing`, `radius`, `border-width`, `border-style`, `shadow`).
- Custom tree → `--tc--custom--<path>--<segments>` (auto-kebab-cased).
- `StyleRef` strings resolve: `var:preset|color|primary` →
  `var(--tc--preset--color--primary)`; `var:custom|…`; raw CSS passes through.

`compileTheme` output:
- `rootVars` — the `:root` declaration map.
- `rules` — scoped selectors for `styles.elements.*` (e.g. `heading` → `h1,…,h6`) and
  `styles.components.*` (→ `[data-gjs-type="<type>"]`), including `:hover/:focus/...`
  pseudo variants. The root style block merges onto `body`.

## Canvas injection (design-system-plugin.ts)

On load: read any persisted `:root` rule → `tokensFromStored` hydrates the store →
re-inject so the rule exists and is protected. Then `subscribe` to the store and
re-inject on every change. Injection writes `:root` + each compiled rule via
`CssComposer.setRule(...)`, marks them `protected: true`, and tracks written
selectors so stale ones are cleared on the next compile.

**Protected** is the linchpin: `filterProtectedStyles` (storage adapter) strips these
on save, so the theme is never duplicated into page blobs.

## Versioned CSS cache contract

1. `updateTenantTheme` bumps `Tenant.themeVersion`.
2. Preview layout emits `<link href=".../theme/[tenantId]/[version]/theme.css">` with
   the current version.
3. The route serves compiled CSS as `immutable`. A theme edit rotates the URL, so the
   browser/CDN fetches fresh; the old URL is harmlessly abandoned. No purge needed.

(The `[version]` segment is a cache key only — the route always serves the *current*
theme.)

## Store mechanics (theme-store.ts)

Snapshot is `{ theme, activePresetId }`. Mutations rebuild only the touched category
subtree (reference-preserving) so `useThemeSelector` subscribers skip unrelated
re-renders. `detectActivePresets(presets)` recomputes which preset (if any) matches
the current tokens after a server round-trip.

## End-to-end flow

DB `Tenant.theme` → (editor) `themeStore.setTheme(tenantTheme)` in `editor-shell.tsx`
→ `designSystemPlugin` injects canvas CSS + `useApplyThemeVars` mirrors to document
root. Edit a token → store emits → both layers update. Save → `updateTenantTheme`
(Zod + version bump). Render → preview layout links the versioned stylesheet;
authored content's `var(--tc--preset--*)` references resolve against it.

## Gotchas

- Open Props CSS must be loaded wherever authored content renders (canvas + publish),
  or every token resolves to nothing.
- Fluid font sizes compile to `clamp(min, value, max)` from the token's `fluid` field.
- Don't write theme rules into page JSON — always go through the store/plugin so they
  stay protected.
