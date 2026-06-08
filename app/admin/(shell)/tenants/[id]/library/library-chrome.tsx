"use client"

import { usePathname } from "next/navigation"

import { AddTemplateDialog } from "./add-template-dialog"
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
 * Library header shell. Lives in the route layout and branches on the URL
 * segment (`/library/templates` vs `/library/patterns`) to pick the
 * title/description/Add-button + kind. Search, filters, and selection now
 * live inside the page-level `TemplatesDataTable` (which owns that state),
 * so the chrome is just the page header + create action.
 */
export function LibraryChrome({ tenantId, children }: Props) {
  const pathname = usePathname()
  const segment = pathname.split("/").filter(Boolean).pop() ?? ""
  const config = VIEWS[segment as keyof typeof VIEWS]

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
      {children}
    </div>
  )
}
