// Default site header template part — the code fallback rendered when a
// tenant has no template at the reserved chrome slug "header" (see
// `resolveChromeBySlug`). Mirrors the theme system's `defaultTheme`: the
// default lives in code, and a DB PART at that slug shadows it when a tenant
// customizes — the same model WordPress uses for default template parts
// (theme `/parts/header.html` shadowed by an edited `wp_template_part`).
//
// Styles use the tenant theme's `--tc--preset--*` CSS variables (emitted by
// the preview layout) with literal fallbacks, so the default picks up brand
// colors when a theme is set and still looks fine without one. Selectors are
// single-class only (no combinators/pseudo-states) to stay on the renderer's
// confirmed CSS path.

import type {
  ComponentDefinition,
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"
import { text, wrapPart } from "./shared"

const HEADER_STYLES: Rule[] = [
  {
    selectors: ["tc-default-header"],
    style: {
      background: "var(--tc--preset--color--background, #ffffff)",
      "border-bottom":
        "1px solid color-mix(in oklch, var(--tc--preset--color--foreground, #111111) 12%, transparent)",
      "font-family":
        "var(--tc--preset--font-family--body, system-ui, sans-serif)",
    },
  },
  {
    selectors: ["tc-default-header__inner"],
    style: {
      "max-width": "72rem",
      margin: "0 auto",
      padding: "1rem 1.5rem",
      display: "flex",
      "align-items": "center",
      "justify-content": "space-between",
      gap: "1.5rem",
    },
  },
  {
    selectors: ["tc-default-header__brand"],
    style: {
      "font-weight": "var(--tc--preset--font-weight--semibold, 600)",
      "font-size": "1.125rem",
      color: "var(--tc--preset--color--foreground, #111111)",
      "text-decoration": "none",
    },
  },
  {
    selectors: ["tc-default-header__nav"],
    style: { display: "flex", "align-items": "center", gap: "1.5rem" },
  },
  {
    selectors: ["tc-default-header__link"],
    style: {
      color: "var(--tc--preset--color--muted-foreground, #555555)",
      "text-decoration": "none",
      "font-size": "0.95rem",
    },
  },
]

const navLink = (label: string): ComponentDefinition => ({
  tagName: "a",
  attributes: { href: "#" },
  classes: ["tc-default-header__link"],
  components: [text(label)],
})

export function defaultHeader(siteName: string): ProjectDefinition {
  return wrapPart(
    {
      tagName: "header",
      classes: ["tc-default-header"],
      components: [
        {
          tagName: "div",
          classes: ["tc-default-header__inner"],
          components: [
            {
              tagName: "a",
              attributes: { href: "/" },
              classes: ["tc-default-header__brand"],
              components: [text(siteName)],
            },
            {
              tagName: "nav",
              classes: ["tc-default-header__nav"],
              components: [
                navLink("Home"),
                navLink("About"),
                navLink("Contact"),
              ],
            },
          ],
        },
      ],
    },
    HEADER_STYLES
  )
}
