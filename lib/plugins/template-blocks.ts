/**
 * Registers Templates as GrapesJS Blocks so users can drag tenant
 * templates from the sidebar like any other block (hero, columns,
 * pattern, …). The plugin is a factory because the template list
 * is per-tenant and resolved server-side; the factory closes over
 * the list and returns the GrapesJS plugin function.
 *
 * Synced templates register a static `template-ref` placeholder as
 * their `content`. On drop, GrapesJS instantiates the placeholder
 * in the page; at render time `resolvePageTree` expands it.
 *
 * Unsynced templates are intentionally skipped today — dropping
 * one needs to also seed the page's `editor.Css` with the
 * template's styles, which isn't wired yet. Once that lands they
 * can register with `content: tpl.data.component` and a style
 * hook on `block:drag:stop` (or equivalent). See §8 follow-ups
 * in docs/templates-followups.md.
 *
 * Blocks are tagged `data-template="true"` at registration time so
 * the React block-inserter (`isPatternBlock`-style split) can later
 * surface them under a dedicated tab if we want — for now they
 * land in the GrapesJS category named after their kind.
 */

import type { Editor } from "grapesjs"
import type { Template } from "@/generated/prisma/client"

import {
  TEMPLATE_REF_SLUG_ATTR,
  TEMPLATE_REF_TYPE,
} from "./template-ref"

const CATEGORY_BY_KIND: Record<Template["kind"], string> = {
  LAYOUT: "Layouts",
  PATTERN: "Patterns",
  PART: "Parts",
}

export const templateBlocksPlugin =
  (templates: Template[]) =>
  (editor: Editor): void => {
    for (const tpl of templates) {
      // Unsynced templates need their styles applied at drop time
      // (not just their component subtree). That plumbing isn't here
      // yet, so we register only synced templates as block entries
      // until it lands.
      if (!tpl.synced) continue

      const blockId = `tpl-${tpl.slug}`
      const labelSuffix = tpl.kind === "PART" && tpl.area ? ` · ${tpl.area}` : ""

      editor.Blocks.add(blockId, {
        label: `${tpl.title}${labelSuffix}`,
        category: CATEGORY_BY_KIND[tpl.kind],
        content: {
          type: TEMPLATE_REF_TYPE,
          attributes: { [TEMPLATE_REF_SLUG_ATTR]: tpl.slug },
        },
        attributes: {
          "data-template": "true",
          "data-template-slug": tpl.slug,
        },
        media: tpl.preview ?? mediaForKind(tpl.kind),
      })
    }
  }

/**
 * Default block thumbnails per kind. Drawn inline as SVG so we can
 * style them with current theme tokens later; for now they're
 * abstract neutrals that read at the Block Manager's typical size.
 */
function mediaForKind(kind: Template["kind"]): string {
  switch (kind) {
    case "LAYOUT":
      return `
        <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
          <rect x="6" y="6" width="48" height="6" rx="1" fill="#9ca3af" opacity=".6"/>
          <rect x="6" y="16" width="30" height="22" rx="1.5" fill="#6366f1" opacity=".5"/>
          <rect x="40" y="16" width="14" height="10" rx="1.5" fill="#e2e8f0"/>
          <rect x="40" y="28" width="14" height="10" rx="1.5" fill="#e2e8f0"/>
        </svg>
      `
    case "PART":
      return `
        <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
          <rect x="6" y="8" width="48" height="6" rx="1.5" fill="#6366f1" opacity=".7"/>
          <rect x="6" y="20" width="32" height="3" rx="1" fill="#9ca3af" opacity=".5"/>
          <rect x="6" y="28" width="40" height="3" rx="1" fill="#9ca3af" opacity=".5"/>
        </svg>
      `
    case "PATTERN":
    default:
      return `
        <svg viewBox="0 0 60 44" xmlns="http://www.w3.org/2000/svg">
          <rect x="1" y="1" width="58" height="42" rx="3" fill="#1e1e2e"/>
          <rect x="6" y="8" width="30" height="6" rx="1.5" fill="#e2e8f0"/>
          <rect x="6" y="18" width="48" height="3" rx="1" fill="#9ca3af" opacity=".6"/>
          <rect x="6" y="24" width="42" height="3" rx="1" fill="#9ca3af" opacity=".6"/>
          <rect x="6" y="34" width="14" height="5" rx="1.5" fill="#6366f1"/>
        </svg>
      `
  }
}
