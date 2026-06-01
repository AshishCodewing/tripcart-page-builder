/**
 * Registers Templates as GrapesJS Blocks so users can drag tenant
 * templates from the sidebar like any other block (hero, columns,
 * pattern, …). The plugin is a factory because the template list
 * is per-tenant and resolved server-side; the factory closes over
 * the list and returns the GrapesJS plugin function.
 *
 * Synced templates register a static `template-ref` placeholder as
 * their `content`. On drop, GrapesJS instantiates the placeholder
 * in the page; at render time `resolvePageTree` expands it (and the
 * §7 canvas preview inlines its content + styles).
 *
 * Unsynced templates register their component subtree directly as
 * `content` (`tpl.data.component`, §9 slim shape). A snapshot — once
 * dropped the copy is independent of the template, matching the
 * unsynced semantic. Because the dropped subtree carries its own
 * ids/classes, its Style-Manager rules (`tpl.data.styles`, the §6
 * precisely-extracted slice) must be seeded into the page's
 * `editor.Css` at drop time, otherwise the copy renders unstyled. We
 * do that on `block:drag:stop`, adding the rules as NON-protected so
 * they persist into `page.data` (the dropped copy owns them now —
 * unlike the synced §7 preview styles, which stay ephemeral).
 *
 * Blocks are tagged `data-template="true"` at registration time so
 * the React block-inserter (`isPatternBlock`-style split) can later
 * surface them under a dedicated tab if we want — for now they
 * land in the GrapesJS category named after their kind.
 *
 * `registerTemplateBlock` is the single registration primitive: the
 * init-time `templateBlocksPlugin` loop and the convert-to-template
 * dialog (registering a freshly-created template so it's draggable
 * without a reload) both call it, so synced/unsynced handling and the
 * drop-seed wiring stay in one place. The per-editor style registry +
 * `block:drag:stop` listener are installed lazily on first call.
 */

import type { Editor } from "grapesjs"
import type { Template } from "@/generated/prisma/client"
import type {
  ComponentDefinition,
  Rule,
} from "@/lib/plugins/react-renderer/project/types"
import type { TemplateBody } from "@/lib/cms/templates"
import { applyTemplateStyles } from "@/lib/plugins/template-styles"

import {
  registerTemplateRefBody,
  registerTemplateRefTitle,
  rootComponentOf,
  TEMPLATE_REF_SLUG_ATTR,
  TEMPLATE_REF_TYPE,
} from "./template-ref"

const CATEGORY_BY_KIND: Record<Template["kind"], string> = {
  LAYOUT: "Layouts",
  PATTERN: "Patterns",
  PART: "Parts",
}

/**
 * Minimal shape `registerTemplateBlock` needs. A full Prisma `Template`
 * satisfies it (its `data` is `JsonValue`, narrowed to `TemplateBody`
 * here); the convert dialog passes a synthesized object built from the
 * server action's result + the locally-snapshotted body.
 */
export type TemplateBlockInput = {
  slug: string
  title: string
  kind: Template["kind"]
  area: string | null
  synced: boolean
  preview?: string | null
  data: TemplateBody
}

// Per-editor block-id → styles map for unsynced templates, looked up on
// `block:drag:stop` to seed the dropped copy's CSS into the page. Keyed
// by editor so a remount (new editor instance) starts clean.
const styleRegistry = new WeakMap<Editor, Map<string, Rule[]>>()

/**
 * Get (creating on first use) the per-editor unsynced-style registry,
 * installing the `block:drag:stop` listener the first time. `component`
 * is null when the drop didn't land on a valid target — nothing to seed
 * in that case.
 */
function getStyleRegistry(editor: Editor): Map<string, Rule[]> {
  let registry = styleRegistry.get(editor)
  if (!registry) {
    registry = new Map<string, Rule[]>()
    styleRegistry.set(editor, registry)
    editor.on("block:drag:stop", (component, block) => {
      if (!component || !block) return
      const styles = registry!.get(block.getId())
      // protect:false — the dropped copy owns these styles, so they
      // persist into page.data (unlike the §7 synced-ref preview).
      if (styles) applyTemplateStyles(editor, styles, { protect: false })
    })
  }
  return registry
}

/**
 * Register one template as a draggable Block. Synced → a static
 * `template-ref` (the resolver / §7 preview expand it). Unsynced → the
 * component subtree itself (a snapshot, independent once dropped), with
 * its styles recorded for drop-time seeding. Returns the block id, or
 * null when an unsynced template has no resolvable root (nothing to
 * drop).
 */
export function registerTemplateBlock(
  editor: Editor,
  tpl: TemplateBlockInput
): string | null {
  const blockId = `tpl-${tpl.slug}`
  const labelSuffix = tpl.kind === "PART" && tpl.area ? ` · ${tpl.area}` : ""

  let content: ComponentDefinition
  if (tpl.synced) {
    content = {
      type: TEMPLATE_REF_TYPE,
      attributes: { [TEMPLATE_REF_SLUG_ATTR]: tpl.slug },
    }
    // Make the slug resolvable by the §7 inline-preview resolver, so a
    // synced ref (dropped from this block or produced by the convert
    // dialog's replaceWith) inlines its content immediately instead of
    // rendering a `missing:<slug>` placeholder until the next reload.
    registerTemplateRefBody(editor, tpl.slug, tpl.data)
    // Title so a synced ref labels itself with the template name
    // (Layer Manager / floating toolbar) instead of the generic
    // "Template Reference" default.
    registerTemplateRefTitle(editor, tpl.slug, tpl.title)
  } else {
    const root = rootComponentOf(tpl.data)
    if (!root) return null
    content = root
    if (Array.isArray(tpl.data.styles) && tpl.data.styles.length > 0) {
      getStyleRegistry(editor).set(blockId, tpl.data.styles)
    }
  }

  editor.Blocks.add(blockId, {
    label: `${tpl.title}${labelSuffix}`,
    category: CATEGORY_BY_KIND[tpl.kind],
    content,
    attributes: {
      "data-template": "true",
      "data-template-slug": tpl.slug,
    },
    media: tpl.preview ?? mediaForKind(tpl.kind),
  })
  return blockId
}

export const templateBlocksPlugin =
  (templates: Template[]) =>
  (editor: Editor): void => {
    for (const tpl of templates) {
      registerTemplateBlock(editor, {
        slug: tpl.slug,
        title: tpl.title,
        kind: tpl.kind,
        area: tpl.area,
        synced: tpl.synced,
        preview: tpl.preview,
        data: (tpl.data ?? {}) as unknown as TemplateBody,
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
