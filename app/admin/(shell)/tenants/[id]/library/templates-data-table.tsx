"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  CopyIcon,
  ListFilterIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Settings2Icon,
  Trash2Icon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import {
  bulkDeleteTemplates,
  duplicateTemplate,
} from "@/lib/cms/template-actions"
import { useConfirmDialog } from "@/hooks/use-confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type TemplateRow = {
  id: string
  title: string
  slug: string
  kind: "LAYOUT" | "PATTERN" | "PART"
  area: string | null
  synced: boolean
  tenantId: string | null
  preview: string | null
  updatedAt: Date | null
  // Code-defined pattern (from the pattern manifest), not a DB row: listed
  // read-only — no edit/delete/select, source shows "Built-in".
  builtin?: boolean
}

type Props = {
  items: TemplateRow[]
  emptyLabel: string
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
})

// Single-string cell value against a set of selected options.
const includesValue = <T,>(
  row: { getValue: (id: string) => unknown },
  id: string,
  filterValue: T[]
): boolean => {
  if (!filterValue?.length) return true
  return filterValue.includes(row.getValue(id) as T)
}

export function TemplatesDataTable({ items, emptyLabel }: Props) {
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
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const { confirm, dialog } = useConfirmDialog({
    title: "Delete templates?",
    description:
      "This permanently removes the selected templates. Any pages that reference them will render a placeholder until updated.",
    confirmText: "Delete",
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

  const columns = React.useMemo<ColumnDef<TemplateRow>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            size="sm"
            aria-label="Select all"
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(Boolean(value))
            }
          />
        ),
        cell: ({ row }) =>
          row.original.builtin ? null : (
            <Checkbox
              size="sm"
              aria-label="Select row"
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
            />
          ),
      },
      {
        accessorKey: "title",
        header: ({ column }) => (
          <SortHeader
            label="Title"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ row }) => {
          const t = row.original
          const thumb = (
            <span className="flex aspect-video w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted/40">
              {t.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.preview}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-[9px] text-muted-foreground">—</span>
              )}
            </span>
          )
          const label = (
            <span className="flex min-w-0 flex-col">
              <span
                className={cn(
                  "truncate font-medium",
                  !t.builtin && "hover:underline"
                )}
              >
                {t.title}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {t.slug}
              </span>
            </span>
          )
          // Built-ins are code-defined — no DB editor route to link to.
          return t.builtin ? (
            <div className="flex min-w-0 items-center gap-3">
              {thumb}
              {label}
            </div>
          ) : (
            <Link
              href={`/admin/templates/${t.id}/edit`}
              className="flex min-w-0 items-center gap-3"
            >
              {thumb}
              {label}
            </Link>
          )
        },
      },
      {
        id: "source",
        accessorFn: (row) =>
          row.builtin ? "builtin" : row.tenantId === null ? "global" : "tenant",
        filterFn: includesValue,
        header: "Source",
        cell: ({ getValue }) => {
          const v = getValue()
          if (v === "builtin")
            return (
              <Badge variant="secondary" fill="outline">
                Built-in
              </Badge>
            )
          return v === "global" ? (
            <Badge>Global</Badge>
          ) : (
            <Badge variant="secondary">Tenant</Badge>
          )
        },
      },
      {
        accessorKey: "area",
        filterFn: includesValue,
        header: "Area",
        cell: ({ getValue }) => {
          const area = getValue() as string | null
          return area ? (
            <span className="capitalize">{area}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        },
      },
      {
        accessorKey: "synced",
        // Filter values arrive as the strings "true" / "false".
        filterFn: (row, id, value: string[]) =>
          !value?.length || value.includes(String(row.getValue(id))),
        header: "Synced",
        cell: ({ row, getValue }) =>
          row.original.builtin ? (
            <span className="text-muted-foreground">—</span>
          ) : getValue() ? (
            <Badge>Synced</Badge>
          ) : (
            <Badge variant="secondary">Unsynced</Badge>
          ),
      },
      {
        accessorKey: "updatedAt",
        // Null-safe (built-ins have no date → sort to the end).
        sortingFn: (a, b) =>
          (a.original.updatedAt?.getTime() ?? 0) -
          (b.original.updatedAt?.getTime() ?? 0),
        header: ({ column }) => (
          <SortHeader
            label="Updated"
            sorted={column.getIsSorted()}
            onToggle={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          />
        ),
        cell: ({ getValue }) => {
          const d = getValue() as Date | null
          return (
            <span className="text-muted-foreground">
              {d ? dateFmt.format(d) : "—"}
            </span>
          )
        },
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const t = row.original
          // Built-ins are code-defined: nothing to edit/duplicate/delete here.
          // To customize one, insert it on a page and use Convert to Template.
          if (t.builtin) {
            return <span className="sr-only">Built-in pattern</span>
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  render={<Link href={`/admin/templates/${t.id}/edit`} />}
                >
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runDuplicate(t.id)}>
                  <CopyIcon />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => void runDelete([t.id])}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [runDelete, runDuplicate]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- intentional "use no memo" opt-out (see above)
  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: (row) => !row.original.builtin,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
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

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
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
            table.getColumn("synced")?.setFilterValue(v.length ? v : undefined)
          }
        />
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

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Columns"
                className="ms-auto"
              />
            }
          >
            <Settings2Icon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    className="capitalize"
                    checked={c.getIsVisible()}
                    onCheckedChange={(value) =>
                      c.toggleVisibility(Boolean(value))
                    }
                  >
                    {c.id === "updatedAt" ? "updated" : c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? "selected" : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No matches.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selectedCount} of {table.getFilteredRowModel().rows.length} row(s)
          selected.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rows per page</span>
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

      {dialog}
    </div>
  )
}

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string
  sorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="-ms-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:text-foreground"
    >
      {label}
      <ArrowUpDownIcon
        className={cn(
          "size-3.5",
          sorted ? "text-foreground" : "text-muted-foreground/60"
        )}
      />
    </button>
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
