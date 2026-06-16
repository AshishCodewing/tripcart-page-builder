// Default site footer template part — the code fallback rendered when a
// tenant has no template at the reserved chrome slug "footer" (see
// `resolveChromeBySlug`). WP analog: theme `/parts/footer.html`, shadowed by
// an edited `wp_template_part`. See `./header.ts` for the styling conventions.

import type {
  ProjectDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"
import { text, wrapPart } from "./shared"

const FOOTER_STYLES: Rule[] = [
  {
    selectors: ["tc-default-footer"],
    style: {
      background: "var(--tc--preset--color--background, #ffffff)",
      "border-top":
        "1px solid color-mix(in oklch, var(--tc--preset--color--foreground, #111111) 12%, transparent)",
      "font-family":
        "var(--tc--preset--font-family--body, system-ui, sans-serif)",
    },
  },
  {
    selectors: ["tc-default-footer__inner"],
    style: {
      "max-width": "72rem",
      margin: "0 auto",
      padding: "2rem 1.5rem",
      color: "var(--tc--preset--color--muted-foreground, #555555)",
      "font-size": "0.875rem",
      "text-align": "center",
    },
  },
]

export function defaultFooter(siteName: string): ProjectDefinition {
  const year = new Date().getFullYear()
  return wrapPart(
    {
      tagName: "footer",
      classes: ["tc-default-footer"],
      components: [
        {
          tagName: "div",
          classes: ["tc-default-footer__inner"],
          components: [text(`© ${year} ${siteName}. All rights reserved.`)],
        },
      ],
    },
    FOOTER_STYLES
  )
}
