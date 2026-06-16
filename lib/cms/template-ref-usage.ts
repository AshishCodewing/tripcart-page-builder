// Where a template's slug is referenced via `template-ref`, by content kind.
// Pure data + formatter (no Prisma) so both server actions and client
// components (the delete-confirm dialog) can use it — the query that
// produces it lives in `lib/cms/templates.ts` (`templateRefUsage`).

export type TemplateRefUsage = {
  pages: number
  posts: number
  templates: number
  total: number
}

export const EMPTY_REF_USAGE: TemplateRefUsage = {
  pages: 0,
  posts: 0,
  templates: 0,
  total: 0,
}

/**
 * Human phrase for the counts, e.g. "3 pages and 1 post" or
 * "2 pages, 1 post, and 1 template". Returns "no content" when nothing
 * references the slug.
 */
export function formatTemplateRefUsage(usage: TemplateRefUsage): string {
  const plural = (n: number, noun: string) =>
    `${n} ${n === 1 ? noun : `${noun}s`}`
  const parts: string[] = []
  if (usage.pages) parts.push(plural(usage.pages, "page"))
  if (usage.posts) parts.push(plural(usage.posts, "post"))
  if (usage.templates) parts.push(plural(usage.templates, "template"))

  if (parts.length === 0) return "no content"
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`
}
