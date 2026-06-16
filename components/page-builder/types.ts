// Discriminated content types for the page-builder shell. The same
// EditorShell + LeftPanel + canvas + chrome serve both Pages and Posts;
// only the right panel field set and the top-bar preview path differ.

import type { TemplateRefUsage } from "@/lib/cms/template-ref-usage"

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
  // No status: templates have no publish lifecycle (see TopBarRight).
  updatedAt: Date
  // How many pages/posts/templates reference this template's slug — drives
  // the pre-delete confirmation warning in the right panel (§5).
  refUsage: TemplateRefUsage
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

export type ContentStatus = "DRAFT" | "PUBLISHED"

// Persisted publish status of the edited record. Drives the top-bar
// primary-action label (Publish vs Update) and the "unpublished changes"
// hint — see TopBarRight. Refreshes as a prop after a commit revalidates
// the editor route, so the button flips without a manual store write.
// Templates have no publish lifecycle, so this is page/post-only — the
// top-bar renders a plain Save for templates and never calls this.
export const contentStatus = (
  content: PageContent | PostContent
): ContentStatus => {
  switch (content.kind) {
    case "page":
      return content.page.status
    case "post":
      return content.post.status
  }
}

// Canonical preview paths the chrome surfaces in the top-bar dropdown +
// preview button. The preview tree mirrors next-wp: pages under
// /pages/<path>, posts under /posts/<slug> (relative to /preview/<tenantId>,
// which `/api/preview` prepends). Templates have no public render path —
// the top-bar hides the preview button via `hasPreview`.
export const previewPath = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return `/pages/${content.page.path}`
    case "post":
      return `/posts/${content.post.slug}`
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
