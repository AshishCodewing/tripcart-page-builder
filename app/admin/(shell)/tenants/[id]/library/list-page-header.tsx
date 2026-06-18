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
    <header className="flex items-start justify-between gap-4 p-6 sticky top-0 z-10 bg-background border-b">
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
