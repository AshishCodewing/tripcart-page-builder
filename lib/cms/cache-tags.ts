export const cacheTags = {
  page: (path: string) => `page:${path}`,
  post: (slug: string) => `post:${slug}`,
  postIndex: "post-index",
  nav: "nav",
  tenants: "tenants",
  tenantTheme: (tenantId: string) => `tenant-theme:${tenantId}`,
} as const
