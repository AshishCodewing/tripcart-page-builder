"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export type TemplateCardItem = {
  id: string
  title: string
  slug: string
  kind: "LAYOUT" | "PATTERN" | "PART"
  area: string | null
  tenantId: string | null
  preview: string | null
  updatedAt: Date
}

type Props = {
  items: TemplateCardItem[]
  emptyLabel: string
}

/**
 * Client grid for Library templates. Reads `q` (title filter) and
 * `source` from the URL so it stays in sync with the toolbar that lives
 * up in the library layout — the two communicate through the URL rather
 * than shared React state.
 */
export function TemplateGrid({ items, emptyLabel }: Props) {
  const searchParams = useSearchParams()
  const query = (searchParams.get("q") ?? "").trim().toLowerCase()
  const source = searchParams.get("source") ?? ""

  const filtered = items.filter((t) => {
    if (query && !t.title.toLowerCase().includes(query)) return false
    if (source === "tenant" && t.tenantId === null) return false
    if (source === "global" && t.tenantId !== null) return false
    return true
  })

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }
  if (filtered.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No matches{query ? ` for “${searchParams.get("q")}”` : ""}.
      </p>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {filtered.map((t) => (
        <Link
          key={t.id}
          href={`/admin/templates/${t.id}/edit`}
          className="group flex flex-col overflow-hidden rounded-lg border transition-colors hover:border-foreground/20 hover:bg-accent/40"
        >
          <div className="flex aspect-video items-center justify-center overflow-hidden border-b bg-muted/40">
            {t.preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.preview}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-muted-foreground">No preview</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1 p-3">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">{t.title}</span>
              {t.tenantId === null && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                  Global
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {t.area ? `${t.kind} · ${t.area}` : t.kind}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
