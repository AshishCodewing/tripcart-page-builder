"use client"

import Link from "next/link"
import {
  CopyIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react"

import { resolveCapabilities } from "@/lib/cms/template-capabilities"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { TemplateRow, TemplateRowHandlers } from "./types"

export function TemplateCardActions({
  t,
  onDuplicate,
  onDuplicateBuiltin,
  onCustomize,
  onDuplicateDefault,
  onReset,
  onDelete,
}: { t: TemplateRow } & TemplateRowHandlers) {
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
