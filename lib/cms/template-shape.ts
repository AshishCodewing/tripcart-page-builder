/**
 * Pure helpers for normalizing a stored template body's root component.
 *
 * Lives in its own module (type-only imports) so both the server resolver
 * (`lib/cms/templates.ts`, which imports the DB client) and the client
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

/**
 * Wrapper-only fields GrapesJS merges onto whatever component sits in a
 * frame's root slot. When a slim template body's content subtree is loaded
 * directly as the frame root (the old load path), the wrapper's defaults —
 * notably a background-only `stylable` whitelist, plus `head`/`docEl` — get
 * baked into the content node and serialized back on autosave. These don't
 * belong on a nested content component.
 */
const DOC_ROOT_ARTIFACT_KEYS = ["stylable", "head", "docEl"] as const

/**
 * Strip document-root artifacts so a content subtree behaves as a normal,
 * fully-stylable child again. A `wrapper`/`body`/`html` root is first
 * rewritten to a plain `<div>` (via {@link unwrapTemplateRoot}); then the
 * `stylable` whitelist and `head`/`docEl` that leaked in while the node was
 * the frame root are dropped so the node's own type defaults apply.
 */
export function sanitizeContentRoot(
  root: ComponentDefinition
): ComponentDefinition {
  const base: ComponentDefinition = isDocumentLevelRoot(root)
    ? unwrapTemplateRoot(root)
    : { ...root }
  for (const key of DOC_ROOT_ARTIFACT_KEYS) delete base[key]
  return base
}

/**
 * Load-time inverse of {@link unwrapEditorRoot}: nest a stored template
 * content root under a real GrapesJS `wrapper` so the content node is a
 * child, not the frame's document root. Editing it then exposes the full
 * Style Manager instead of the wrapper's background-only whitelist, and no
 * wrapper defaults get merged back into the content on save. The root is
 * sanitized first, healing rows that were previously polluted while edited
 * as the frame root.
 */
export function wrapEditorRoot(root: ComponentDefinition): ComponentDefinition {
  return { type: "wrapper", components: [sanitizeContentRoot(root)] }
}

/**
 * Save-time inverse of {@link wrapEditorRoot}: pull the content root back
 * out of the synthetic editor wrapper. A single-child wrapper yields that
 * child verbatim; an empty or multi-child wrapper collapses to one nestable
 * `<div>` root (via {@link unwrapTemplateRoot}) so the stored body stays a
 * single component. A non-wrapper root passes through untouched — defensive
 * against legacy payloads or a caller that never wrapped.
 */
export function unwrapEditorRoot(root: ComponentDefinition): ComponentDefinition {
  if (root.type !== "wrapper") return root
  const children = Array.isArray(root.components) ? root.components : []
  if (children.length === 1) return children[0]
  return unwrapTemplateRoot(root)
}
