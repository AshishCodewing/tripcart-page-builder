// Discriminated content types for the page-builder shell. The same
// EditorShell + LeftPanel + canvas + chrome serve both Pages and Posts;
// only the right panel field set and the top-bar preview path differ.

export type PageRecord = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  tenantId: string
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

export type PostRecord = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tenantId: string
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

export type TemplateRecord = {
  id: string
  title: string
  slug: string
  // null = global library row; non-null = tenant-scoped (shadows globals)
  tenantId: string | null
  kind: "LAYOUT" | "PATTERN" | "PART"
  area: string | null
  synced: boolean
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

export type ParentOption = {
  id: string
  title: string
  path: string
}

export type PageContent = {
  kind: "page"
  page: PageRecord
  parentOptions: ParentOption[]
}

export type PostContent = {
  kind: "post"
  post: PostRecord
}

export type TemplateContent = {
  kind: "template"
  template: TemplateRecord
}

export type EditorContent = PageContent | PostContent | TemplateContent

// Canonical preview paths the chrome surfaces in the top-bar dropdown +
// preview button. Pages live at the root, posts under /blog/<slug>.
// Templates have no public render path — the top-bar hides the preview
// button via `hasPreview`.
export const previewPath = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return `/${content.page.path}`
    case "post":
      return `/blog/${content.post.slug}`
    case "template":
      return ""
  }
}

export const hasPreview = (content: EditorContent): boolean =>
  content.kind !== "template"

// Tenant the content belongs to. Pages and posts always have one; a
// template can be global (returns null) or tenant-scoped.
export const contentTenantId = (content: EditorContent): string | null => {
  switch (content.kind) {
    case "page":
      return content.page.tenantId
    case "post":
      return content.post.tenantId
    case "template":
      return content.template.tenantId
  }
}

// Display title surfaced in the top-bar middle crumb.
export const contentTitle = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return content.page.title
    case "post":
      return content.post.title
    case "template":
      return content.template.title
  }
}

// Singular label used after the title in the top-bar middle crumb.
export const contentKindLabel = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return "Page"
    case "post":
      return "Post"
    case "template":
      // Show the template's own kind (Layout / Pattern / Part) rather
      // than a generic "Template" label so the chrome makes the role
      // visible at a glance.
      return (
        content.template.kind.charAt(0) +
        content.template.kind.slice(1).toLowerCase()
      )
  }
}

// Where the "back" link in the top-bar dropdown should go.
export const contentIndexHref = (content: EditorContent): string => {
  const tenantId = contentTenantId(content)
  // Global templates have no tenant — send the user to the all-tenants
  // listing rather than 404-ing on a missing tenantId.
  if (!tenantId) return "/admin/tenants"
  return `/admin/tenants/${tenantId}`
}

// Signature retained for symmetry with contentIndexHref even though the
// content arg isn't needed now that every page/post has a tenant.
export const contentIndexLabel = (content: EditorContent): string =>
  content.kind === "template" && !contentTenantId(content)
    ? "Back to tenants"
    : "Back to tenant"
