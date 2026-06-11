# §3 — Create-template-from-scratch UI (Templates + Patterns pages)

Implementation guide for §3 of `docs/reference/templates-followups.md`. This is the **browse + create**
entry point for templates — today the only way a template comes into existence is the
convert-from-selection flow in the page editor; there's no admin surface to author one from
nothing or to see what a tenant already has.

> **Prerequisite (done):** the storage migration (localStorage → Postgres `draftData`) has
> landed, so a freshly-created blank template autosaves its draft to the DB and is editable
> across devices. Without it, "create from scratch" was incoherent (the new template opened
> blank with no durable persistence).

## Decisions (locked in)

| Decision | Choice |
|---|---|
| Kind split | **Templates page = `LAYOUT`**; **Patterns page = `PATTERN` + `PART`** (template parts) |
| Routes | Tenant-scoped: `/admin/tenants/[id]/templates` and `/admin/tenants/[id]/patterns` |
| Add flow | A dialog (title etc.) → create a blank row → `redirect()` straight into the editor |
| Global library | Deferred (separate concern) |

No shadcn installs needed — `dialog`, `radio-group`, `switch`, `table`, and the sidebar
sub-menu primitives all already exist in `components/ui/`.

**base-nova composition uses the `render` prop, not `asChild`** — see
`components/admin/admin-sidebar.tsx` (`render={<Link .../>}`). Use
`<DialogTrigger render={<Button>…</Button>} />`.

---

## 1. `createTemplate` server action  → `lib/cms/template-actions.ts`

Creates a blank row and redirects into the editor. Extract the slug logic (already duplicated
in `createTemplateFromSelection`) into a shared helper and reuse it from both.

```ts
import { redirect } from "next/navigation" // add to imports

// Shared — also refactor createTemplateFromSelection to call this.
async function deriveUniqueSlug(tenantId: string, title: string): Promise<string> {
  const baseSlug = titleToSlug(title)
  if (!baseSlug)
    throw new Error("Title must contain at least one letter or number.")
  validateSlug(baseSlug)
  let slug = baseSlug
  let suffix = 2
  while (
    await prisma.template.findUnique({
      where: { tenantId_slug: { tenantId, slug } },
      select: { id: true },
    })
  ) {
    slug = `${baseSlug}-${suffix}`
    suffix++
  }
  return slug
}

export async function createTemplate(
  tenantId: string,
  form: FormData
): Promise<void> {
  if (!tenantId) throw new Error("Tenant is required.")

  const title = String(form.get("title") ?? "").trim()
  const kindField = String(form.get("kind") ?? "").trim()
  const areaField = String(form.get("area") ?? "").trim()
  const synced = form.get("synced") === "true"

  if (!title) throw new Error("Title is required.")
  if (kindField !== "LAYOUT" && kindField !== "PATTERN" && kindField !== "PART")
    throw new Error("Kind must be LAYOUT, PATTERN, or PART.")
  const kind = kindField as "LAYOUT" | "PATTERN" | "PART"
  if (kind === "PART" && !areaField)
    throw new Error("Area is required for PART templates.")

  const slug = await deriveUniqueSlug(tenantId, title)

  const created = await prisma.template.create({
    data: {
      tenantId,
      slug,
      title,
      kind,
      area: kind === "PART" ? areaField : null,
      synced,
      status: "DRAFT",
      // `data` defaults to "{}" (Prisma). The editor opens blank and
      // autosaves to `draftData`; the first Publish writes `data`.
    },
    select: { id: true, slug: true },
  })

  updateTag(cacheTags.template(created.slug))
  redirect(`/admin/templates/${created.id}/edit`)
}
```

---

## 2. Index pages (server components)

Lift the table + "no items" pattern from `app/admin/(shell)/tenants/[id]/page.tsx`.
`listTemplates(id)` returns the tenant's rows **plus visible globals** (`tenantId === null`) —
optionally badge the globals.

### `app/admin/(shell)/tenants/[id]/templates/page.tsx`

```tsx
const all = await listTemplates(id)
const templates = all.filter((t) => t.kind === "LAYOUT")
const create = createTemplate.bind(null, id)
// header with <CreateTemplateDialog mode="template" action={create} />
// table: Title | Status | Updated | Edit-link (→ /admin/templates/${t.id}/edit)
```

### `app/admin/(shell)/tenants/[id]/patterns/page.tsx`

Same shape, but:

```tsx
const patterns = all.filter((t) => t.kind === "PATTERN" || t.kind === "PART")
// <h1>Patterns</h1>, <CreateTemplateDialog mode="pattern" action={create} />
// table adds Kind + Area columns so PARTs (header/footer/sidebar) are distinguishable
```

---

## 3. `components/admin/create-template-dialog.tsx`  (client)

One component, two modes. `mode="template"` → title only, kind fixed to `LAYOUT`.
`mode="pattern"` → title + Pattern/Template-part radio + a conditional Area field (required for
PART) + a Synced switch. The page binds `createTemplate` and passes it as `action`; the
action `redirect()`s, which unmounts the dialog.

```tsx
"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

export function CreateTemplateDialog({
  mode,
  action,
}: {
  mode: "template" | "pattern"
  action: (formData: FormData) => void | Promise<void>
}) {
  const isTemplate = mode === "template"
  const [kind, setKind] = React.useState<"PATTERN" | "PART">("PATTERN")

  return (
    <Dialog>
      <DialogTrigger render={<Button>{isTemplate ? "Add template" : "Add pattern"}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isTemplate ? "New template" : "New pattern"}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          <input type="hidden" name="kind" value={isTemplate ? "LAYOUT" : kind} />

          <div className="space-y-2">
            <Label htmlFor="tpl-title">Title</Label>
            <Input id="tpl-title" name="title" required autoFocus />
          </div>

          {!isTemplate && (
            <>
              <div className="space-y-2">
                <Label>Type</Label>
                <RadioGroup
                  value={kind}
                  onValueChange={(v) => setKind(v as "PATTERN" | "PART")}
                  className="flex gap-4"
                >
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PATTERN" /> Pattern
                  </Label>
                  <Label className="flex items-center gap-2 font-normal">
                    <RadioGroupItem value="PART" /> Template part
                  </Label>
                </RadioGroup>
              </div>

              {kind === "PART" && (
                <div className="space-y-2">
                  <Label htmlFor="tpl-area">Area</Label>
                  <Input id="tpl-area" name="area" placeholder="header / footer / sidebar" required />
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* synced default: on for parts (chrome is synced by intent), off for patterns */}
                <Switch id="tpl-synced" name="synced" value="true" defaultChecked={kind === "PART"} />
                <Label htmlFor="tpl-synced">Synced</Label>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit">Create &amp; edit</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

**Watch:** confirm this repo's `Switch` posts a form value — Radix switches emit the hidden
`<input name=… value=…>` only when checked. If `synced` doesn't arrive server-side, replace the
`name`/`value` props with a controlled hidden input mirroring a `useState` boolean. The server
reads `form.get("synced") === "true"`.

---

## 4. Sidebar — Templates / Patterns  → `components/admin/admin-sidebar.tsx`

Already a `"use client"` component using `usePathname`. The `(shell)/layout.tsx` that renders it
sits above the `[id]` segment, so derive the tenant id from the pathname:

```tsx
const pathname = usePathname()
const m = pathname.match(/^\/admin\/tenants\/([^/]+)(?:\/|$)/) // not the /admin/tenants list
const tenantId = m?.[1]

const tenantNav = tenantId
  ? [
      { href: `/admin/tenants/${tenantId}`, label: "Overview", exact: true },
      { href: `/admin/tenants/${tenantId}/templates`, label: "Templates" },
      { href: `/admin/tenants/${tenantId}/patterns`, label: "Patterns" },
    ]
  : []
```

Render `tenantNav` as a second `SidebarGroup` (label "Tenant") below the existing Content group,
using the same `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton` markup
(`render={<Link href=… />}`). Use exact match for Overview (`pathname === href`) and
`startsWith` for Templates/Patterns.

*(Optional)* add "Templates →" / "Patterns →" links in the header of the tenant detail page,
next to the existing "Edit theme →" link, for discoverability without the sidebar.

---

## Files touched

| Action | File |
|---|---|
| `createTemplate` + `deriveUniqueSlug` | `lib/cms/template-actions.ts` |
| New | `app/admin/(shell)/tenants/[id]/templates/page.tsx` |
| New | `app/admin/(shell)/tenants/[id]/patterns/page.tsx` |
| New | `components/admin/create-template-dialog.tsx` |
| Edit (sidebar) | `components/admin/admin-sidebar.tsx` |
| Optional (header links) | `app/admin/(shell)/tenants/[id]/page.tsx` |

No Prisma migration, no shadcn installs.

## Verify

- `pnpm typecheck` / `pnpm lint` clean.
- `/admin/tenants/<id>/templates`: sidebar shows Templates/Patterns; "Add template" → dialog
  (title only) → editor opens blank → build → autosaves to `draftData` → Publish → row appears.
- `/admin/tenants/<id>/patterns`: "Add pattern" → **Pattern** creates a PATTERN; **Template
  part** reveals + requires Area and creates a PART (area shows in the row); Synced toggle is
  reflected on the created row.
- Kind filter holds: LAYOUT only on Templates; PATTERN+PART only on Patterns.
- Slug collision: two "Home" templates → the second persists as `home-2`.
