/**
 * Registers the `template-ref` GrapesJS component type.
 *
 * A `template-ref` is a thin placeholder node that stands in for a
 * resolved Template at render time. The page's saved JSON only stores
 * the slug; the server-side `resolvePageTree` (see lib/cms/templates.ts)
 * inlines the referenced template's tree when rendering.
 *
 * On the editor canvas (§7) a `template-ref` inlines the referenced
 * template's content as **locked** children, so a converted header /
 * hero / footer shows its real content instead of a one-line label.
 * Clicking the inlined content bubbles selection up to the ref (the
 * children are locked, the ref is not) which surfaces the "Edit
 * template" toolbar action. The inlined children are never persisted
 * back into the page blob — `model.toJSON` strips them, so the page's
 * saved tree keeps just `{ type, attributes: { data-slug } }`.
 *
 * The factory closes over the tenant's `templates` (same list the
 * `templateBlocksPlugin` registers as draggable blocks) so the inline
 * lookup is in-memory — no per-ref fetch. Tenant rows shadow globals
 * because `listTemplates` returns tenant rows first and the map is
 * built first-wins.
 *
 * The template's ad-hoc Style-Manager rules (`data.styles`, now the §6
 * precisely-extracted subtree slice) are injected into the editor's CSS
 * model as **protected** rules (via `applyTemplateStyles`) and re-applied
 * on every `editor.on("load")` — the same pattern `designSystemPlugin`
 * uses for the theme layer. They go through the CSS model (not a detached
 * iframe `<style>`) precisely so they survive a reload / navigation:
 * GrapesJS re-renders its own CSS model into the canvas on every frame
 * load, whereas a hand-appended `<style>` is outside that lifecycle and
 * silently vanishes. `protected` keeps them out of saved page data
 * (`filterProtectedStyles` / tc-local strip them); the dedupe inside
 * `applyTemplateStyles` guarantees we never flip a page-owned rule to
 * protected. See §7 in docs/templates-followups.md.
 *
 * GrapesJS APIs used (per docs):
 *   - `editor.Components.addType` — component-type registration
 *     (https://grapesjs.com/docs/api/component_manager.html)
 *   - `editor.Css.addRules(cssString)` — batch CSS parsing, returns
 *     `CssRule[]` so we can flag each rule as `protected`
 *     (https://grapesjs.com/docs/api/css_composer.html#addrules)
 *   - `editor.UndoManager.skip(fn)` — run the programmatic inline append
 *     without recording it on the undo stack
 *     (https://grapesjs.com/docs/api/undo_manager.html)
 *   - `editor.Commands.add` — custom command registered for the
 *     toolbar's "Edit template" action. The command emits a custom
 *     editor event that the React shell listens for to handle the
 *     route navigation (the plugin layer has no router access).
 *
 * Marking the placeholder CSS rules `protected: true` mirrors how
 * `designSystemPlugin` handles tenant theme rules — the `tc-local`
 * storage adapter filters protected rules so they don't get duplicated
 * into every per-page project blob.
 */

import type { Component, Editor } from "grapesjs"
import type { Template } from "@/generated/prisma/client"
import type { TemplateBody } from "@/lib/cms/templates"
import type { ComponentDefinition } from "@/lib/plugins/react-renderer/project/types"
import { applyTemplateStyles } from "@/lib/plugins/template-styles"

export const TEMPLATE_REF_TYPE = "template-ref"
export const TEMPLATE_REF_SLUG_ATTR = "data-slug"

/**
 * Transient attribute used to carry the nesting depth down to inlined
 * child `template-ref`s so a cyclic / pathologically deep chain can't
 * freeze the canvas. Never persisted: it only ever lands on inlined
 * children, which `toJSON` drops along with the rest of the preview.
 */
const DEPTH_ATTR = "data-tc-tpl-depth"

/**
 * Editor-side preview depth cap. Lower than the server resolver's
 * MAX_DEPTH (16) — the canvas just needs enough levels for a realistic
 * layout/part/pattern chain while bailing fast on a cycle.
 */
const MAX_PREVIEW_DEPTH = 8

/**
 * Event fired by the `tc:edit-template-ref` command. The React shell
 * subscribes to this on the editor instance to perform the route
 * navigation (e.g. router.push to the template editor).
 */
export const TEMPLATE_REF_EDIT_EVENT = "tc:template-ref:edit"

const PLACEHOLDER_CSS = `
.tc-template-ref {
  display: block;
}
.tc-template-ref:has(> .tc-template-ref__label) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: var(--size-3, 0.75rem) var(--size-4, 1rem);
  min-height: 64px;
  background: color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 8%, transparent);
  border: 1px dashed color-mix(in oklch, var(--tc--preset--color--primary, hsl(220 90% 56%)) 35%, transparent);
  border-radius: var(--tc--preset--radius--md, 0.375rem);
  font-family: var(--tc--preset--font-family--body, system-ui, sans-serif);
  font-size: var(--tc--preset--font-size--small, 0.875rem);
  color: var(--tc--preset--color--muted-foreground, hsl(0 0% 40%));
}
.tc-template-ref__label::before {
  content: "";
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--tc--preset--color--primary, hsl(220 90% 56%));
  flex-shrink: 0;
}
.tc-template-ref__label strong {
  font-weight: var(--tc--preset--font-weight--semibold, 600);
  color: var(--tc--preset--color--foreground, hsl(0 0% 10%));
}
.tc-template-ref:has(> .tc-template-ref__label--error) {
  border-color: color-mix(in oklch, var(--tc--preset--color--destructive, hsl(0 80% 50%)) 50%, transparent);
  background: color-mix(in oklch, var(--tc--preset--color--destructive, hsl(0 80% 50%)) 6%, transparent);
}
`

/**
 * Resolve a template's root component from either the §9 slim shape
 * (`{ component, styles }`) or the legacy full-project shape. Mirrors
 * the same fallback in `resolvePageTree`.
 */
export function rootComponentOf(
  body: TemplateBody | undefined
): ComponentDefinition | undefined {
  if (!body) return undefined
  return body.component ?? body.pages?.[0]?.frames?.[0]?.component
}

/**
 * Deep-clone a component definition, stamping `DEPTH_ATTR` on every
 * nested `template-ref` so each inlines one level deeper. Refs are
 * normally leaf nodes in stored template data, but we recurse fully to
 * stay correct if a template authored a ref nested inside other markup.
 */
function stampRefDepth(
  def: ComponentDefinition,
  depth: number
): ComponentDefinition {
  const node: ComponentDefinition = { ...def }
  const isRef =
    node.type === TEMPLATE_REF_TYPE ||
    (typeof node.tagName === "string" &&
      node.tagName.toLowerCase() === TEMPLATE_REF_TYPE)
  if (isRef) {
    node.attributes = { ...(node.attributes ?? {}), [DEPTH_ATTR]: String(depth) }
  }
  if (Array.isArray(node.components)) {
    node.components = node.components.map((c) => stampRefDepth(c, depth))
  }
  return node
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export const templateRefPlugin =
  (templates: Template[] = []) =>
  (editor: Editor): void => {
    // slug → body, tenant-first (listTemplates returns tenant rows
    // before globals; first-wins keeps a tenant shadow ahead of the
    // global it overrides).
    const bodyBySlug = new Map<string, TemplateBody>()
    for (const tpl of templates) {
      if (!bodyBySlug.has(tpl.slug)) {
        bodyBySlug.set(tpl.slug, (tpl.data ?? {}) as unknown as TemplateBody)
      }
    }

    // Per-model state kept off the model itself so it never leaks into
    // `toJSON` / the saved blob: which refs have already inlined, and
    // the placeholder reason (when a ref couldn't be resolved) that
    // `onRender` reads to label the empty box.
    const inlined = new WeakSet<object>()
    const placeholderReason = new WeakMap<object, string>()

    // Inject the placeholder CSS as protected rules — same convention
    // designSystemPlugin uses for the theme layer. tc-local strips
    // protected rules from saved page blobs.
    const rules = editor.Css.addRules(PLACEHOLDER_CSS)
    for (const rule of rules) rule.set("protected", true)

    // §7 — inlined-template style injection.
    //
    // Slugs whose preview styles we've injected this session. Tracked so
    // the `load` handler below can re-apply them after a reload: GrapesJS
    // loads the stored (protected-stripped) styles on load, so the only
    // way the protected preview rules come back is for us to re-inject —
    // the same approach designSystemPlugin uses for the theme layer.
    const inlinedSlugs = new Set<string>()

    // Push a template's `data.styles` into the CSS model as protected
    // rules (stripped from saved data, re-rendered into the canvas by
    // GrapesJS on every frame load). Collision-safe via the dedupe inside
    // applyTemplateStyles.
    const injectPreviewStyles = (slug: string): void => {
      applyTemplateStyles(editor, bodyBySlug.get(slug)?.styles, {
        protect: true,
      })
    }

    // Re-apply every inlined ref's styles after the project (re)loads.
    // Refs' `init()` runs during the load and repopulates `inlinedSlugs`
    // before this fires, so iterating the set here re-injects them on top
    // of the freshly-loaded (preview-rule-free) CSS model.
    editor.on("load", () => {
      for (const slug of inlinedSlugs) injectPreviewStyles(slug)
    })

    // Custom command for navigating to the template editor. The plugin
    // doesn't have router access, so it just emits an event the React
    // shell listens for. See editor-shell.tsx for the navigation handler.
    editor.Commands.add("tc:edit-template-ref", {
      run(ed, _sender, opts) {
        const slug = (opts as { slug?: string } | undefined)?.slug ?? ""
        ed.trigger(TEMPLATE_REF_EDIT_EVENT, { slug })
      },
    })

    editor.Components.addType(TEMPLATE_REF_TYPE, {
      isComponent: (el) => {
        if (!el || typeof el !== "object") return false
        const tag =
          "tagName" in el && typeof (el as HTMLElement).tagName === "string"
            ? (el as HTMLElement).tagName.toLowerCase()
            : ""
        return tag === TEMPLATE_REF_TYPE
      },
      model: {
        defaults: {
          tagName: TEMPLATE_REF_TYPE,
          name: "Template Reference",
          draggable: true,
          droppable: false,
          editable: false,
          selectable: true,
          hoverable: true,
          removable: true,
          copyable: true,
          attributes: { [TEMPLATE_REF_SLUG_ATTR]: "", class: "tc-template-ref" },
          // Read-only trait so users can see which template is bound.
          // The convert-to-template flow + Block drops set this on insert;
          // changing it manually is power-user territory and intentionally
          // gated here.
          traits: [
            {
              type: "text",
              name: TEMPLATE_REF_SLUG_ATTR,
              label: "Template slug",
              changeProp: false,
              attributes: { readonly: "readonly" },
            },
          ],
          toolbar: [
            {
              attributes: { class: "fa fa-pencil", title: "Edit template" },
              command: (ed: Editor) => {
                const cmp = ed.getSelected()
                const slug = cmp?.getAttributes()[TEMPLATE_REF_SLUG_ATTR] ?? ""
                ed.runCommand("tc:edit-template-ref", { slug })
              },
            },
            { attributes: { class: "fa fa-arrows" }, command: "tlb-move" },
            { attributes: { class: "fa fa-clone" }, command: "tlb-clone" },
            { attributes: { class: "fa fa-trash-o" }, command: "tlb-delete" },
          ],
        },

        init() {
          // Resolve + inline once. init() runs on model creation —
          // for refs loaded from storage, dropped from a block, or
          // produced by the convert-to-template replaceWith.
          const model = this as unknown as Component
          if (inlined.has(model)) return
          inlined.add(model)

          const attrs = model.getAttributes()
          const slug = String(attrs[TEMPLATE_REF_SLUG_ATTR] ?? "")
          const depth = Number(attrs[DEPTH_ATTR] ?? 0)

          if (!slug) {
            placeholderReason.set(model, "unbound")
            return
          }
          if (depth > MAX_PREVIEW_DEPTH) {
            placeholderReason.set(model, `max-depth:${slug}`)
            return
          }

          const body = bodyBySlug.get(slug)
          if (!body) {
            placeholderReason.set(model, `missing:${slug}`)
            return
          }
          const root = rootComponentOf(body)
          if (!root) {
            placeholderReason.set(model, `empty:${slug}`)
            return
          }

          // Locked so child clicks bubble to the ref; non-layerable so
          // the preview subtree doesn't clutter the Layers panel. Depth
          // stamped on any nested ref inside the body.
          const childDef: ComponentDefinition = {
            ...stampRefDepth(root, depth + 1),
            locked: true,
            layerable: false,
          }

          editor.UndoManager.skip(() => {
            model.append(childDef as object)
          })

          // §7: surface the template's Style-Manager rules on the canvas
          // so the inlined preview matches the published render. Injected
          // into the CSS model as protected rules (never persisted, but
          // re-rendered by GrapesJS across frame reloads). Recorded so the
          // `load` handler re-injects them after a navigate-away/back.
          // Covers live insertion (drag-drop / convert replaceWith); the
          // `load` handler covers the reload path.
          inlinedSlugs.add(slug)
          injectPreviewStyles(slug)
        },

        /**
         * The page blob stores a `template-ref` as just its slug — the
         * inlined preview children are editor-only and resolved fresh
         * on every load. Returning a minimal node here keeps them out
         * of `getProjectData()` (publish path) and the `tc-local`
         * autosave alike, so no downstream filtering is needed. The
         * default class/traits re-apply from `defaults` on reload.
         */
        toJSON() {
          const model = this as unknown as Component
          const attrs = { ...model.getAttributes() }
          delete attrs[DEPTH_ATTR]
          return { type: TEMPLATE_REF_TYPE, attributes: attrs }
        },
      },
      view: {
        onRender({ el, model }) {
          // Resolved: GrapesJS rendered the inlined children into `el`.
          // Leave them be — the `:has(> .label)` chrome rule won't match,
          // so the ref renders as a transparent wrapper around content.
          if (model.components().length > 0) return

          // Unresolved (unbound / missing / empty / cyclic): show a
          // labelled placeholder. `placeholderReason` distinguishes a
          // plain unbound ref from an error so the chrome can go red.
          const reason = placeholderReason.get(model as unknown as object) ?? ""
          const slug = String(model.getAttributes()[TEMPLATE_REF_SLUG_ATTR] ?? "")
          const isError = reason !== "" && reason !== "unbound"
          const labelClass = isError
            ? "tc-template-ref__label tc-template-ref__label--error"
            : "tc-template-ref__label"
          const inner = slug
            ? `Template <strong>${escapeHtml(slug)}</strong>`
            : "Template <strong>(unbound)</strong>"
          const detail = isError ? ` — ${escapeHtml(reason)}` : ""
          el.innerHTML = `<span class="${labelClass}">${inner}${detail}</span>`
        },
      },
    })
  }
