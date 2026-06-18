"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type SortingState,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CopyIcon,
  ListFilterIcon,
  LockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  bulkDeleteTemplates,
  customizeDefaultLayout,
  customizeDefaultPart,
  duplicateBuiltinPattern,
  duplicateDefaultPart,
  duplicateTemplate,
} from "@/lib/cms/template-actions"
import {
  resolveCapabilities,
  type RowOrigin,
} from "@/lib/cms/template-capabilities"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

type Props = {
  items: TemplateRow[]
  emptyLabel: string
  // The tenant whose Library this is — the scope a built-in pattern is
  // duplicated into (built-in rows themselves carry `tenantId: null`).
  tenantId: string
  // Parts are always synced by intent (a template part is a by-reference
  // include), so the Parts library hides the Synced column + filter. Patterns
  // and layouts keep it (ref vs. copy is a real choice there).
  showSynced?: boolean
}

// Single-string cell value against a set of selected options.
const includesValue = <T,>(
  row: { getValue: (id: string) => unknown },
  id: string,
  filterValue: T[]
): boolean => {
  if (!filterValue?.length) return true
  return filterValue.includes(row.getValue(id) as T)
}

export function TemplatesDataTable({
  items,
  emptyLabel,
  tenantId,
  showSynced = true,
}: Props) {
  // TanStack Table mutates its `table` object in place rather than returning a
  // fresh reference, which breaks React's immutability rules: React Compiler
  // would memoize reads off `table` into stale UI. The directive opts this
  // component out of compilation; see https://github.com/facebook/react/issues/33057
  "use no memo"
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [rowSelection, setRowSelection] = React.useState({})

  const { confirm, dialog } = useConfirmDialog({
    title: "Delete templates?",
    description:
      "This permanently removes the selected templates. Any pages that reference them will render a placeholder until updated.",
    confirmText: "Delete",
    cancelText: "Cancel",
    destructive: true,
  })

  const { confirm: confirmReset, dialog: resetDialog } = useConfirmDialog({
    title: "Reset to default?",
    description:
      "This discards your customizations and reverts to the default.",
    confirmText: "Reset",
    cancelText: "Cancel",
    destructive: true,
  })

  const runDelete = React.useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      if (!(await confirm())) return
      startTransition(async () => {
        await bulkDeleteTemplates(ids)
        setRowSelection({})
        router.refresh()
      })
    },
    [confirm, router]
  )

  const runDuplicate = React.useCallback(
    (id: string) => {
      startTransition(async () => {
        await duplicateTemplate(id)
        router.refresh()
      })
    },
    [router]
  )

  // Edit a synthetic default row — materializes the DB row (shadowing the
  // code/hierarchy default) and navigates into the editor (the action
  // redirects). Branches by kind: a PART shadows the reserved chrome slug, a
  // LAYOUT materializes the template-hierarchy type.
  const runCustomize = React.useCallback(
    (tenantId: string | null, slug: string, kind: TemplateRow["kind"]) => {
      if (!tenantId) return
      startTransition(async () => {
        if (kind === "LAYOUT") {
          await customizeDefaultLayout(tenantId, slug)
        } else {
          await customizeDefaultPart(tenantId, slug)
        }
      })
    },
    []
  )

  // Duplicate a built-in (code-defined) pattern into an editable tenant
  // pattern. The action creates a blank row and redirects into the editor with
  // `?seed=<blockId>`, which inserts the built-in block's content on load.
  const runDuplicateBuiltin = React.useCallback(
    (blockId: string) => {
      startTransition(async () => {
        await duplicateBuiltinPattern(tenantId, blockId)
      })
    },
    [tenantId]
  )

  // Duplicate a synthetic default into an independent part (non-reserved
  // slug) — stays on the listing, so refresh to surface the new row.
  const runDuplicateDefault = React.useCallback(
    (tenantId: string | null, slug: string) => {
      if (!tenantId) return
      startTransition(async () => {
        await duplicateDefaultPart(tenantId, slug)
        router.refresh()
      })
    },
    [router]
  )

  // Reset a customized default ("shadow" row) — delete the DB row so the slug
  // falls back to its code/hierarchy default (chrome part reverts to
  // `defaultHeader`/`defaultFooter`; a hierarchy template reverts to its
  // synthetic "Default" placeholder).
  const runReset = React.useCallback(
    async (id: string) => {
      if (!(await confirmReset())) return
      startTransition(async () => {
        await bulkDeleteTemplates([id])
        router.refresh()
      })
    },
    [confirmReset, router]
  )

  // Logical-only columns: TanStack Table is headless, so these drive search,
  // faceted filters, faceting, and the default sort — the visual rendering
  // lives in <TemplateCard>, not in cell renderers.
  const columns = React.useMemo<ColumnDef<TemplateRow>[]>(
    () => [
      { accessorKey: "title" },
      {
        id: "source",
        accessorFn: (row) =>
          row.origin === "default"
            ? "default"
            : row.origin === "builtin"
              ? "builtin"
              : row.tenantId === null
                ? "global"
                : "tenant",
        filterFn: includesValue,
      },
      { accessorKey: "area", filterFn: includesValue },
      ...(showSynced
        ? ([
            {
              accessorKey: "synced",
              // Filter values arrive as the strings "true" / "false".
              filterFn: (row, id, value: string[]) =>
                !value?.length || value.includes(String(row.getValue(id))),
            },
          ] as ColumnDef<TemplateRow>[])
        : []),
      {
        accessorKey: "updatedAt",
        // Null-safe (built-ins have no date → sort to the end).
        sortingFn: (a, b) =>
          (a.original.updatedAt?.getTime() ?? 0) -
          (b.original.updatedAt?.getTime() ?? 0),
      },
    ],
    [showSynced]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- intentional "use no memo" opt-out (see above)
  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    // Selectable iff the row can be hard-deleted — bulk delete only operates on
    // those. Shadow rows revert to their default ("Reset") rather than delete,
    // so they're excluded; built-ins and synthetic defaults aren't selectable.
    enableRowSelection: (row) =>
      resolveCapabilities(row.original.origin, row.original.kind)
        .destructive === "delete",
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    // Search spans title + slug.
    globalFilterFn: (row, _columnId, value: string) => {
      const q = value.trim().toLowerCase()
      if (!q) return true
      const t = row.original
      return (
        t.title.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
      )
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const areaOptions = React.useMemo(() => {
    const set = new Set<string>()
    for (const it of items) if (it.area) set.add(it.area)
    return [...set].sort().map((a) => ({ value: a, label: a }))
  }, [items])

  const selectedIds = table
    .getFilteredSelectedRowModel()
    .rows.map((r) => r.original.id)
  const selectedCount = selectedIds.length
  // Whether any row on this tab can be selected — drives the selected-count
  // line (hidden on edit-only tabs like Templates where nothing is selectable).
  const hasSelectable = table
    .getFilteredRowModel()
    .rows.some((r) => r.getCanSelect())

  if (items.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">{emptyLabel}</p>
  }

  const rows = table.getRowModel().rows

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6">
        <InputGroup className="max-w-xs">
          <InputGroupAddon align="inline-start">
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search title or slug"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </InputGroup>

        <FacetedFilter
          label="Source"
          options={[
            { value: "tenant", label: "This tenant" },
            { value: "global", label: "Global library" },
            { value: "builtin", label: "Built-in" },
          ]}
          selected={
            (table.getColumn("source")?.getFilterValue() as string[]) ?? []
          }
          onChange={(v) =>
            table.getColumn("source")?.setFilterValue(v.length ? v : undefined)
          }
        />
        {showSynced && (
          <FacetedFilter
            label="Synced"
            options={[
              { value: "true", label: "Synced" },
              { value: "false", label: "Unsynced" },
            ]}
            selected={
              (table.getColumn("synced")?.getFilterValue() as string[]) ?? []
            }
            onChange={(v) =>
              table
                .getColumn("synced")
                ?.setFilterValue(v.length ? v : undefined)
            }
          />
        )}
        {areaOptions.length > 0 && (
          <FacetedFilter
            label="Area"
            options={areaOptions}
            selected={
              (table.getColumn("area")?.getFilterValue() as string[]) ?? []
            }
            onChange={(v) =>
              table.getColumn("area")?.setFilterValue(v.length ? v : undefined)
            }
          />
        )}

        {selectedCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => void runDelete(selectedIds)}
          >
            <Trash2Icon />
            Delete ({selectedCount})
          </Button>
        )}
      </div>

      {/* Grid */}
      {rows.length ? (
        <div className="grid grid-cols-2 gap-4 px-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((row) => (
            <TemplateCard
              key={row.id}
              row={row}
              showSynced={showSynced}
              onDuplicate={runDuplicate}
              onDuplicateBuiltin={runDuplicateBuiltin}
              onCustomize={runCustomize}
              onDuplicateDefault={runDuplicateDefault}
              onReset={runReset}
              onDelete={(id) => void runDelete([id])}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No matches.
        </div>
      )}

      {/* Pagination — hidden when there are fewer than 10 items. */}
      {table.getFilteredRowModel().rows.length >= 10 && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background p-6">
          {hasSelectable ? (
            <p className="text-sm text-muted-foreground">
              {selectedCount} of {table.getFilteredRowModel().rows.length}{" "}
              item(s) selected.
            </p>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per page</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(v) => table.setPageSize(Number(v))}
              >
                <SelectTrigger size="sm" className="w-[4.5rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm text-muted-foreground">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount() || 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="First page"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronsLeftIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Last page"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <ChevronsRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog}
      {resetDialog}
    </div>
  )
}

function SourceBadge({ row }: { row: TemplateRow }) {
  if (row.origin === "default")
    return (
      <Badge variant="secondary" fill="outline">
        Default
      </Badge>
    )
  if (row.origin === "builtin")
    return (
      <Badge variant="secondary" fill="outline">
        Built-in
      </Badge>
    )
  return row.tenantId === null ? (
    <Badge>Global</Badge>
  ) : (
    <Badge variant="secondary">Tenant</Badge>
  )
}

function TemplateCard({
  row,
  showSynced,
  onDuplicate,
  onDuplicateBuiltin,
  onCustomize,
  onDuplicateDefault,
  onReset,
  onDelete,
}: {
  row: Row<TemplateRow>
  showSynced: boolean
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
}) {
  const t = row.original
  const caps = resolveCapabilities(t.origin, t.kind)
  const selectable = row.getCanSelect()
  const selected = row.getIsSelected()
  // Only rows that open the editor directly (`edit: "link"`) get a link;
  // built-ins and synthetic defaults are customized from the actions menu.
  const linkable = caps.edit === "link"

  const preview = (
    <span className="flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-t-xl border-b bg-muted/40">
      {t.preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={t.preview}
          alt=""
          className="h-full w-full object-cover object-top"
        />
      ) : (
        <span className="text-xs text-muted-foreground">No preview</span>
      )}
    </span>
  )

  return (
    <Card
      size="sm"
      data-state={selected ? "selected" : undefined}
      className="relative gap-0 data-[size=sm]:gap-0 data-[size=sm]:py-0 data-[state=selected]:ring-2 data-[state=selected]:ring-primary"
    >
      {/* Selection checkbox — overlay on the preview, revealed on hover or
          when selected. Built-ins / synthetic defaults aren't selectable. */}
      {selectable && (
        <span
          className={cn(
            "absolute inset-s-2 top-2 z-10 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-0 group-hover/card:opacity-100 focus-within:opacity-100"
          )}
        >
          <Checkbox
            size="sm"
            aria-label="Select item"
            className="bg-background"
            checked={selected}
            onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
          />
        </span>
      )}

      {linkable ? (
        <Link href={`/admin/templates/${t.id}/edit`}>{preview}</Link>
      ) : (
        preview
      )}

      <CardContent className="flex items-start gap-2 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            {linkable ? (
              <Link
                href={`/admin/templates/${t.id}/edit`}
                className="truncate font-medium hover:underline"
              >
                {t.title}
              </Link>
            ) : (
              <span className="truncate font-medium">{t.title}</span>
            )}
            {showSynced && t.synced && (
              <LockIcon
                aria-label="Synced"
                className="size-3 shrink-0 text-muted-foreground"
              />
            )}
          </div>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {t.slug}
          </span>
          {t.description && (
            <p className="mt-0.5 line-clamp-3 text-xs text-muted-foreground">
              {t.description}
            </p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <SourceBadge row={t} />
            {t.area && (
              <Badge variant="secondary" fill="outline" className="capitalize">
                {t.area}
              </Badge>
            )}
            {showSynced &&
              (t.origin === "user" || t.origin === "shadow") &&
              (t.synced ? (
                <Badge>Synced</Badge>
              ) : (
                <Badge variant="secondary">Unsynced</Badge>
              ))}
          </div>
        </div>

        <TemplateCardActions
          t={t}
          onDuplicate={onDuplicate}
          onDuplicateBuiltin={onDuplicateBuiltin}
          onCustomize={onCustomize}
          onDuplicateDefault={onDuplicateDefault}
          onReset={onReset}
          onDelete={onDelete}
        />
      </CardContent>
    </Card>
  )
}

function TemplateCardActions({
  t,
  onDuplicate,
  onDuplicateBuiltin,
  onCustomize,
  onDuplicateDefault,
  onReset,
  onDelete,
}: {
  t: TemplateRow
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
}) {
  // Every menu item is derived from the central capability matrix — the same
  // rules the server actions enforce. See `lib/cms/template-capabilities.ts`.
  const caps = resolveCapabilities(t.origin, t.kind)

  // Nothing actionable (e.g. a code-defined non-pattern built-in): read-only.
  if (!caps.edit && !caps.duplicate && !caps.destructive) {
    return <span className="sr-only">Built-in</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Actions"
          />
        }
      >
        <MoreHorizontalIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {/* Edit: a `link` row opens the editor directly; a `customize` row
            materializes its shadowed default first (the action redirects). */}
        {caps.edit === "link" && (
          <DropdownMenuItem
            render={<Link href={`/admin/templates/${t.id}/edit`} />}
          >
            <PencilIcon />
            Edit
          </DropdownMenuItem>
        )}
        {caps.edit === "customize" && (
          <DropdownMenuItem
            onClick={() => onCustomize(t.tenantId, t.slug, t.kind)}
          >
            <PencilIcon />
            Edit
          </DropdownMenuItem>
        )}

        {/* Duplicate: clone a DB row, fork a synthetic default, or copy a
            built-in pattern into an editable tenant pattern. */}
        {caps.duplicate === "row" && (
          <DropdownMenuItem onClick={() => onDuplicate(t.id)}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
        )}
        {caps.duplicate === "default" && (
          <DropdownMenuItem
            onClick={() => onDuplicateDefault(t.tenantId, t.slug)}
          >
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
        )}
        {caps.duplicate === "builtin" && (
          <DropdownMenuItem onClick={() => onDuplicateBuiltin(t.slug)}>
            <CopyIcon />
            Duplicate
          </DropdownMenuItem>
        )}

        {/* Destructive: a customized chrome part reverts to its code default
            (transparent shadow) rather than being deleted outright. */}
        {caps.destructive === "reset" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onReset(t.id)}
            >
              <RotateCcwIcon />
              Reset to default
            </DropdownMenuItem>
          </>
        )}
        {caps.destructive === "delete" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onDelete(t.id)}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FacetedFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <ListFilterIcon className="size-4" />
        {label}
        {selected.length > 0 && (
          <Badge variant="secondary" className="ms-1 px-1.5">
            {selected.length}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{label}</DropdownMenuLabel>
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
            >
              {opt.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        {selected.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange([])}>
              Clear
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
