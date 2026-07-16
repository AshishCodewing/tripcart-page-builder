import { Badge } from "@/components/ui/badge"

import type { TemplateRow } from "./types"

export function SourceBadge({ row }: { row: TemplateRow }) {
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
