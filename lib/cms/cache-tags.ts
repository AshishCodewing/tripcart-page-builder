export const cacheTags = {
  page: (path: string) => `page:${path}`,
  post: (slug: string) => `post:${slug}`,
  postIndex: "post-index",
  nav: "nav",
} as const
