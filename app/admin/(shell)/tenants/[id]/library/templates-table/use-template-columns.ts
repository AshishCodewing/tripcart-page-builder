"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"

import type { TemplateRow } from "./types"

// Single-string cell value against a set of selected options.
const includesValue = <T,>(
  row: { getValue: (id: string) => unknown },
  id: string,
  filterValue: T[]
): boolean => {
  if (!filterValue?.length) return true
  return filterValue.includes(row.getValue(id) as T)
}

// Logical-only columns: TanStack Table is headless, so these drive search,
// faceted filters, faceting, and the default sort — the visual rendering
// lives in <TemplateCard>, not in cell renderers.
export function useTemplateColumns(
  showSynced: boolean
): ColumnDef<TemplateRow>[] {
  return React.useMemo<ColumnDef<TemplateRow>[]>(
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
}
