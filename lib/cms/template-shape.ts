/**
 * Pure helpers for normalizing a stored template body's root component.
 *
 * Lives in its own module (type-only imports) so both the server resolver
 * (`lib/cms/templates.ts`, which imports `prisma`) and the client
 * `template-ref` plugin (which imports grapesjs) can share it without
 * dragging one's runtime deps into the other's bundle.
 *
 * Why this exists: a template's `data.component` is meant to be a content
 * subtree. But the convert-to-template flow could (before the wrapper
 * guard landed) capture the page's root `wrapper` — a `type:"wrapper"` /
 * `tagName:"body"` node carrying `head`/`docEl`. Inlining or resolving
 * that nests a `<body>` inside the consuming markup (e.g. inside a
 * `template-ref`), which is invalid HTML — React logs hydration errors
 * and GrapesJS' canvas chokes. `unwrapTemplateRoot` defangs such rows:
 * it replaces a document-level root with a plain `<div>` carrying the
 * same children, so existing bad data (and any future slip past the
 * authoring guard) renders validly everywhere.
 */

import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"

const DOC_LEVEL_TAGS = new Set(["body", "html", "head"])

/** True for a document-level root that can't be a nested child. */
function isDocumentLevelRoot(root: ComponentDefinition): boolean {
  if (root.type === "wrapper") return true
  const tag = typeof root.tagName === "string" ? root.tagName.toLowerCase() : ""
  return DOC_LEVEL_TAGS.has(tag)
}

/**
 * Return a root that's safe to nest. A normal content subtree passes
 * through untouched; a document-level root (`wrapper`/`body`/`html`) is
 * rewritten to a plain `<div>` preserving its children, dropping the
 * document-only fields (`type`, `docEl`, `head`, `…El`) that don't belong
 * inside the page.
 */
export function unwrapTemplateRoot(
  root: ComponentDefinition
): ComponentDefinition {
  if (!isDocumentLevelRoot(root)) return root
  return {
    tagName: "div",
    attributes: { ...(root.attributes ?? {}), "data-tc-template-root": "true" },
    components: Array.isArray(root.components) ? root.components : [],
  }
}
