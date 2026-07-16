import type { RowOrigin } from "@/lib/cms/template-capabilities"

export type TemplateRow = {
  id: string
  title: string
  slug: string
  description?: string | null
  kind: "LAYOUT" | "PATTERN" | "PART"
  area: string | null
  synced: boolean
  tenantId: string | null
  preview: string | null
  updatedAt: Date | null
  // Provenance of the row — drives every edit/duplicate/delete decision via
  // `resolveCapabilities` (see `lib/cms/template-capabilities.ts`). `builtin`
  // and `default` rows have no DB id (built-ins use a manifest id; defaults a
  // `default:<slug>` sentinel); `chrome`/`user` are real DB rows.
  origin: RowOrigin
}

// The row-level action callbacks threaded from the table down to each card and
// its actions menu. Stable identities (all useCallback'd in
// useTemplateActions) so the card grid doesn't re-render per row.
export type TemplateRowHandlers = {
  onDuplicate: (id: string) => void
  onDuplicateBuiltin: (blockId: string) => void
  onCustomize: (
    tenantId: string | null,
    slug: string,
    kind: TemplateRow["kind"]
  ) => void
  onDuplicateDefault: (tenantId: string | null, slug: string) => void
  onReset: (id: string) => void
  onDelete: (id: string) => void
}
