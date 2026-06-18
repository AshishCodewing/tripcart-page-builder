// The WP-style template hierarchy: the template *types* the site resolves at
// render time (single post, archive, 404, …). Until a tenant authors a real
// LAYOUT at the slug, the Library lists each as a "Default" placeholder row;
// editing one materializes a tenant-scoped LAYOUT at that slug (the WP
// transparent-shadow model — see `customizeDefaultLayout`). Pure data so both
// the server action and the (server-component) Library page can import it.

export type TemplateHierarchyEntry = {
  slug: string
  title: string
  description: string
}

export const TEMPLATE_HIERARCHY = [
  {
    slug: "archive",
    title: "All Archives",
    description:
      "Displays any archive, including posts by a single author, category, tag, taxonomy, custom post type, and date. This template will serve as a fallback when more specific templates (e.g. Category or Tag) cannot be found.",
  },
  {
    slug: "home",
    title: "Blog Home",
    description:
      'Displays the latest posts as either the site homepage or as the "Posts page" as defined under reading settings. If it exists, the Front Page template overrides this template when posts are shown on the homepage.',
  },
  {
    slug: "index",
    title: "Index",
    description:
      "Used as a fallback template for all pages when a more specific template is not defined.",
  },
  {
    slug: "page-no-title",
    title: "Page No Title",
    description: "Displays a static page without showing its title.",
  },
  {
    slug: "404",
    title: "Page: 404",
    description:
      "Displays when a visitor views a non-existent page, such as a dead link or a mistyped URL.",
  },
  {
    slug: "page",
    title: "Pages",
    description:
      "Displays a static page unless a custom template has been applied to that page or a dedicated template exists.",
  },
  {
    slug: "search",
    title: "Search Results",
    description: "Displays when a visitor performs a search on your website.",
  },
  {
    slug: "single",
    title: "Single Posts",
    description:
      "Displays a single post on your website unless a custom template has been applied to that post or a dedicated template exists.",
  },
] as const satisfies readonly TemplateHierarchyEntry[]

// The set of valid hierarchy slugs as a literal union — used to type the
// chrome assignment key (a part is assigned to one or more of these) and to
// validate slugs posted from the Part editor's assignment multi-select.
export type TemplateHierarchySlug = (typeof TEMPLATE_HIERARCHY)[number]["slug"]

export function getHierarchyEntry(
  slug: string
): TemplateHierarchyEntry | undefined {
  return TEMPLATE_HIERARCHY.find((e) => e.slug === slug)
}

export function isHierarchySlug(value: string): value is TemplateHierarchySlug {
  return TEMPLATE_HIERARCHY.some((e) => e.slug === value)
}
