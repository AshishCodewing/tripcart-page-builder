"use client"

import { useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { AddTemplateDialog } from "./add-template-dialog"
import { LibraryToolbar, type SourceFilter } from "./library-toolbar"
import { ListPageHeader } from "./list-page-header"

const VIEWS = {
  templates: {
    title: "Templates",
    description: null as string | null,
    addLabel: "Add Template",
    kind: "LAYOUT",
  },
  patterns: {
    title: "All patterns",
    description: "A list of all patterns from all sources.",
    addLabel: "Add Pattern",
    kind: "PATTERN",
  },
} as const

type Props = {
  tenantId: string
  children: React.ReactNode
}

/**
 * Library header/toolbar shell. Lives in the route layout and branches on
 * the URL segment (`/library/templates` vs `/library/patterns`) to pick
 * the title/description/Add-button + kind. Search and view-mode are
 * written to the URL (`?q=`, `?view=`) so the page-level grid — which
 * can't share React state across the layout/page boundary — can read
 * them back via `useSearchParams`.
 */
export function LibraryChrome({ tenantId, children }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()

  const segment = pathname.split("/").filter(Boolean).pop() ?? ""
  const config = VIEWS[segment as keyof typeof VIEWS]

  // Local mirror of `?q=` for a responsive input; the URL write is
  // debounced. Reconcile from the URL when the segment changes (sidebar
  // nav drops the query) using the render-time "adjust state on prop
  // change" pattern — no effect, so no cascading-render lint trip.
  const [query, setQuery] = useState(searchParams.get("q") ?? "")
  const [prevPath, setPrevPath] = useState(pathname)
  if (pathname !== prevPath) {
    setPrevPath(pathname)
    setQuery(searchParams.get("q") ?? "")
  }

  const source = (searchParams.get("source") ?? "") as SourceFilter

  const writeParam = (key: string, value: string | null): void => {
    const sp = new URLSearchParams(searchParams.toString())
    if (value) sp.set(key, value)
    else sp.delete(key)
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onQueryChange = (value: string): void => {
    setQuery(value)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => writeParam("q", value || null), 200)
  }

  if (!config) return <>{children}</>

  return (
    <div className="space-y-6">
      <ListPageHeader
        title={config.title}
        description={config.description}
        action={
          <AddTemplateDialog
            tenantId={tenantId}
            kind={config.kind}
            label={config.addLabel}
          />
        }
      />
      <LibraryToolbar
        query={query}
        source={source}
        onQueryChange={onQueryChange}
        onSourceChange={(v) => writeParam("source", v || null)}
      />
      {children}
    </div>
  )
}
