// Discriminated content types for the page-builder shell. The same
// EditorShell + LeftPanel + canvas + chrome serve both Pages and Posts;
// only the right panel field set and the top-bar preview path differ.

export type PageRecord = {
  id: string
  title: string
  slug: string
  parentId: string | null
  path: string
  status: "DRAFT" | "PUBLISHED"
  updatedAt: Date
}

export type PostRecord = {
  id: string
  title: string
  slug: string
  excerpt: string | null
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

export type EditorContent = PageContent | PostContent

// Canonical preview paths the chrome surfaces in the top-bar dropdown +
// preview button. Pages live at the root, posts under /blog/<slug>.
export const previewPath = (content: EditorContent): string => {
  switch (content.kind) {
    case "page":
      return `/${content.page.path}`
    case "post":
      return `/blog/${content.post.slug}`
  }
}

// Display title surfaced in the top-bar middle crumb.
export const contentTitle = (content: EditorContent): string =>
  content.kind === "page" ? content.page.title : content.post.title

// Singular label used after the title in the top-bar middle crumb.
export const contentKindLabel = (content: EditorContent): string =>
  content.kind === "page" ? "Page" : "Post"

// Where the "back" link in the top-bar dropdown should go.
export const contentIndexHref = (content: EditorContent): string =>
  content.kind === "page" ? "/admin/pages" : "/admin/posts"

export const contentIndexLabel = (content: EditorContent): string =>
  content.kind === "page" ? "Back to pages" : "Back to posts"
