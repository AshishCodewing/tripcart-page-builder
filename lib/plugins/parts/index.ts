// Built-in template parts (WP analog: theme `/parts/*.html`). Code-defined
// site chrome rendered as the fallback when a tenant has no DB template at the
// reserved chrome slug ("header" / "footer"). A tenant customizes by creating
// a PART at that slug, which shadows these defaults (see `resolveChromeBySlug`
// in `lib/cms/templates.ts`).

export { defaultHeader } from "./header"
export { defaultFooter } from "./footer"
