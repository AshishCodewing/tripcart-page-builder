"use client"

import * as React from "react"
import {
  type ColumnFiltersState,
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
  SearchIcon,
  Trash2Icon,
} from "lucide-react"

import { resolveCapabilities } from "@/lib/cms/template-capabilities"
import { Button } from "@/components/ui/button"
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

import { FacetedFilter } from "./templates-table/faceted-filter"
import { TemplateCard } from "./templates-table/template-card"
import { useTemplateActions } from "./templates-table/use-template-actions"
import { useTemplateColumns } from "./templates-table/use-template-columns"
import type { TemplateRow } from "./templates-table/types"

export type { TemplateRow } from "./templates-table/types"

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
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [globalFilter, setGlobalFilter] = React.useState("")

  const {
    pending,
    rowSelection,
    setRowSelection,
    dialog,
    resetDialog,
    runDelete,
    handlers,
  } = useTemplateActions(tenantId)

  const columns = useTemplateColumns(showSynced)

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
              {...handlers}
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
