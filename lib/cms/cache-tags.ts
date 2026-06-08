export const cacheTags = {
  page: (path: string) => `page:${path}`,
  post: (slug: string) => `post:${slug}`,
  postIndex: "post-index",
  nav: "nav",
  tenants: "tenants",
  tenantTheme: (tenantId: string) => `tenant-theme:${tenantId}`,
  // Tag every render-path resolver cache that touches a given template
  // by slug, so we can invalidate consumers when the template changes.
  // (Resolver caching itself isn't wired yet — this is here so callers
  // landing in the next iteration don't have to amend cache-tags too.)
  template: (slug: string) => `template:${slug}`,
} as const
