"use client"

import * as React from "react"
import type { Component, Editor } from "grapesjs"

import {
  TEMPLATE_REF_SLUG_ATTR,
  TEMPLATE_REF_TYPE,
} from "@/lib/plugins/template-ref"
import { registerTemplateBlock } from "@/lib/plugins/template-blocks"
import { getPageStyles } from "@/lib/plugins/tc-storage-adapter"
import { extractStylesForSubtree } from "@/lib/cms/style-extract"
import { createTemplateFromSelection } from "@/lib/cms/template-actions"
import type { ComponentDefinition, Rule } from "@/lib/plugins/react-renderer/project/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

type Kind = "LAYOUT" | "PATTERN" | "PART"

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Selected GrapesJS components at the moment the dialog opens — always
   * captured via `editor.getSelectedAll()` so multi-selection is
   * supported. One element ⇒ saved as-is; multiple ⇒ wrapped in a thin
   * `<div data-template-fragment>` container at submit so the template
   * keeps a single root (the resolver expands one ref into one node).
   * Captured by the parent so a later canvas click can't repoint the
   * conversion mid-flow.
   */
  selected: Component[]
  tenantId: string | null
  /**
   * Live editor instance, used at submit-time to snapshot the page's
   * CSS rules. Without this, the new template would be saved with
   * `styles: []` — any Style-Manager-edited CSS that targeted the
   * converted subtree (e.g. `#i_abc { color: red }`) would be lost on
   * the next save once the original components are removed from the
   * page. Tailwind/class-based styling rides through unaffected
   * because it lives on the components, not in `styles[]`.
   */
  editor: Editor | null
}

export function ConvertTemplateDialog({
  open,
  onOpenChange,
  selected,
  tenantId,
  editor,
}: Props) {
  const [title, setTitle] = React.useState("")
  const [kind, setKind] = React.useState<Kind>("PATTERN")
  const [area, setArea] = React.useState("")
  const [synced, setSynced] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset on close so the next open starts clean. Pairing this with
  // onOpenChange (rather than a useEffect on `open`) keeps the reset
  // out of an effect — see react-hooks/set-state-in-effect.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setTitle("")
      setKind("PATTERN")
      setArea("")
      setSynced(false)
      setError(null)
      setSubmitting(false)
    }
    onOpenChange(next)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected.length || !tenantId || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const form = new FormData()
      form.set("title", title)
      form.set("kind", kind)
      form.set("area", area)
      form.set("synced", synced ? "true" : "false")

      // Templates have a single root. One selection passes through
      // unchanged; multiple get bundled into a thin fragment container
      // so the resolver can still expand one ref into one node. The
      // `data-template-fragment` marker is there for future renderer
      // treatment (e.g. emitting `display: contents` so the wrapper
      // doesn't break parent flex/grid layouts).
      const subtree =
        selected.length === 1
          ? selected[0].toJSON()
          : {
              tagName: "div",
              attributes: { "data-template-fragment": "true" },
              components: selected.map((c) => c.toJSON()),
            }
      // Component `toJSON()` is shallow — nested `components`/`classes`
      // can still be live Backbone collections/models, not plain data.
      // Serialize once to a fully-plain tree we use for BOTH the form
      // payload and the style extractor (which walks the subtree for its
      // ids/classes and would otherwise only see the root).
      const subtreeJson = JSON.stringify(subtree)
      form.set("subtree", subtreeJson)
      const plainSubtree = JSON.parse(subtreeJson) as ComponentDefinition

      // Snapshot the CSS rules that target the converted subtree into
      // the new template so any Style-Manager edits (`#i_abc { ... }`)
      // survive the selection removal. `getPageStyles` reads the
      // CssRules collection directly and drops protected (theme) rules
      // — those are served via the tenant theme stylesheet and must not
      // be baked into a template. `extractStylesForSubtree` then narrows
      // the snapshot to only the rules whose selectors reference an
      // id/class inside the subtree (§6), instead of dragging the whole
      // page's styles[] along. Tailwind/class-based styling rides through
      // untouched — it lives on the components, not in styles[].
      //
      // `getPageStyles` returns `rule.toJSON()` whose `selectors` are
      // still live GrapesJS Selector model instances (their `name`/`type`
      // live behind `.get()`). Normalize to plain JSON first — that's the
      // exact shape that ends up posted/stored — so the pure-data
      // extractor can read selectors as strings / `{ name, type }`.
      const pageStyles: Rule[] = editor
        ? JSON.parse(JSON.stringify(getPageStyles(editor)))
        : []
      const styles = extractStylesForSubtree(pageStyles, plainSubtree)
      form.set("styles", JSON.stringify(styles))

      const result = await createTemplateFromSelection(tenantId, form)

      if (synced) {
        // Swap the converted selection with a placeholder ref so
        // subsequent edits flow through the template. For unsynced
        // conversions the page is unchanged — the template is just a
        // saved starting point.
        //
        // Multi-select: replace the first node with the ref (preserves
        // position), then remove the rest. Iterating in reverse so
        // index-shifting doesn't bite if any siblings are adjacent in
        // the same parent.
        selected[0].replaceWith({
          type: TEMPLATE_REF_TYPE,
          attributes: { [TEMPLATE_REF_SLUG_ATTR]: result.slug },
        })
        for (let i = selected.length - 1; i >= 1; i--) {
          selected[i].remove()
        }
      }

      // Surface the new template in the Block Manager immediately so the
      // user can drag another copy without a page reload — same primitive
      // the init-time `templateBlocksPlugin` uses, so synced (a ref) and
      // unsynced (the component subtree + drop-time style seeding) are
      // handled identically. `plainSubtree` is the exact body just stored,
      // so the block matches what a reload would register.
      if (editor) {
        registerTemplateBlock(editor, {
          slug: result.slug,
          title: result.title,
          kind: result.kind,
          area: result.area,
          synced: result.synced,
          data: { component: plainSubtree, styles },
        })
      }
      handleOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create template</DialogTitle>
          <DialogDescription>
            Save this selection as a reusable template. Synced templates
            stay linked — edits propagate everywhere they&apos;re used.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ct-title">Title</Label>
            <Input
              id="ct-title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site header"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Kind</Label>
            <RadioGroup
              value={kind}
              onValueChange={(v) => setKind(v as Kind)}
              className="grid-cols-3"
            >
              {(["LAYOUT", "PATTERN", "PART"] as const).map((k) => (
                <Label
                  key={k}
                  className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm"
                >
                  <RadioGroupItem value={k} size="sm" />
                  {k.charAt(0) + k.slice(1).toLowerCase()}
                </Label>
              ))}
            </RadioGroup>
          </div>

          {kind === "PART" && (
            <div className="space-y-2">
              <Label htmlFor="ct-area">Area</Label>
              <Input
                id="ct-area"
                name="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="header / footer / sidebar"
                required
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="ct-synced" className="cursor-pointer">
                Synced
              </Label>
              <p className="text-xs text-muted-foreground">
                Replace this selection with a link to the template so
                future edits propagate.
              </p>
            </div>
            <Switch
              id="ct-synced"
              checked={synced}
              onCheckedChange={setSynced}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter showCloseButton>
            <Button
              type="submit"
              disabled={submitting || !selected.length || !tenantId}
            >
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
