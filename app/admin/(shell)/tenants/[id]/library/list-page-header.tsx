type Props = {
  title: string
  description?: string | null
  action?: React.ReactNode
}

/**
 * Title (+ optional description) on the left, an action slot on the
 * right. Presentational — the owning surface supplies content. Shared by
 * the Library Templates/Patterns pages via the library chrome.
 */
export function ListPageHeader({ title, description, action }: Props) {
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  )
}
