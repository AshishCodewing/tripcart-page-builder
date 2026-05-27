/**
 * Registers the `template-ref` GrapesJS component type.
 *
 * A `template-ref` is a thin placeholder node that stands in for a
 * resolved Template at render time. The page's saved JSON only stores
 * the slug; the server-side `resolvePageTree` (see lib/cms/templates.ts)
 * inlines the referenced template's tree when rendering.
 *
 * On the editor canvas this MVP renders a labelled placeholder rather
 * than the resolved tree — enough to convey "a header lives here." A
 * follow-up can fetch the resolved tree and inline it as locked
 * children for a true preview.
 *
 * GrapesJS APIs used (per docs):
 *   - `editor.Components.addType` — component-type registration
 *     (https://grapesjs.com/docs/api/component_manager.html)
 *   - `editor.Css.addRules(cssString)` — batch CSS parsing, returns
 *     `CssRule[]` so we can flag each rule as `protected`
 *     (https://grapesjs.com/docs/api/css_composer.html#addrules)
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

import type { Editor } from "grapesjs"

export const TEMPLATE_REF_TYPE = "template-ref"
export const TEMPLATE_REF_SLUG_ATTR = "data-slug"

/**
 * Event fired by the `tc:edit-template-ref` command. The React shell
 * subscribes to this on the editor instance to perform the route
 * navigation (e.g. router.push to the template editor).
 */
export const TEMPLATE_REF_EDIT_EVENT = "tc:template-ref:edit"

const PLACEHOLDER_CSS = `
.tc-template-ref {
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
.tc-template-ref::before {
  content: "";
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--tc--preset--color--primary, hsl(220 90% 56%));
  flex-shrink: 0;
}
.tc-template-ref strong {
  font-weight: var(--tc--preset--font-weight--semibold, 600);
  color: var(--tc--preset--color--foreground, hsl(0 0% 10%));
}
.tc-template-ref[data-template-placeholder] {
  border-color: color-mix(in oklch, var(--tc--preset--color--destructive, hsl(0 80% 50%)) 50%, transparent);
  background: color-mix(in oklch, var(--tc--preset--color--destructive, hsl(0 80% 50%)) 6%, transparent);
}
`

export const templateRefPlugin = (editor: Editor): void => {
  // Inject the placeholder CSS as protected rules — same convention
  // designSystemPlugin uses for the theme layer. tc-local strips
  // protected rules from saved page blobs.
  const rules = editor.Css.addRules(PLACEHOLDER_CSS)
  for (const rule of rules) rule.set("protected", true)

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
        // The placeholder content is rendered by view.onRender; children
        // are not user-editable. (When we later inline the resolved tree
        // as locked children, set locked: true so child clicks bubble to
        // the ref itself.)
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
    },
    view: {
      onRender({ el, model }) {
        const slug = model.getAttributes()[TEMPLATE_REF_SLUG_ATTR] ?? ""
        const label = slug ? escapeHtml(slug) : "(unbound)"
        el.innerHTML = `<span>Template <strong>${label}</strong></span>`
      },
    },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
