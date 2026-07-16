"use client"

import Link from "next/link"
import { type Row } from "@tanstack/react-table"
import { LockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { resolveCapabilities } from "@/lib/cms/template-capabilities"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

import { SourceBadge } from "./source-badge"
import { TemplateCardActions } from "./template-card-actions"
import type { TemplateRow, TemplateRowHandlers } from "./types"

export function TemplateCard({
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
} & TemplateRowHandlers) {
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
