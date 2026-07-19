import { relations, sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { createdAt, cuid, updatedAt } from "./_shared"

export const contentStatus = pgEnum("ContentStatus", ["DRAFT", "PUBLISHED"])
export const templateKind = pgEnum("TemplateKind", [
  "LAYOUT",
  "PATTERN",
  "PART",
])

export const tenants = pgTable(
  "tenants",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    domain: text("domain"),
    theme: jsonb("theme").notNull().default({}),
    themeVersion: integer("themeVersion").notNull().default(1),
    themeCss: text("themeCss"),
    themeCssHash: text("themeCssHash"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("tenants_slug_key").on(t.slug),
    uniqueIndex("tenants_domain_key").on(t.domain),
  ]
)

export const chromeAssignments = pgTable(
  "chrome_assignments",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    tenantId: text("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade", onUpdate: "cascade" }),
    segment: text("segment").notNull(),
    headerSlug: text("headerSlug"),
    footerSlug: text("footerSlug"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("chrome_assignments_tenantId_segment_key").on(
      t.tenantId,
      t.segment
    ),
  ]
)

export const pages = pgTable(
  "pages",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    slug: text("slug").notNull(),
    path: text("path").notNull(),
    parentId: text("parentId").references((): AnyPgColumn => pages.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    tenantId: text("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade", onUpdate: "cascade" }),
    title: text("title").notNull(),
    data: jsonb("data").notNull().default({}),
    draftData: jsonb("draftData"),
    css: text("css"),
    cssHash: text("cssHash"),
    status: contentStatus("status").notNull().default("DRAFT"),
    publishedAt: timestamp("publishedAt", { precision: 3, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("pages_tenantId_path_key").on(t.tenantId, t.path),
    uniqueIndex("pages_parentId_slug_key").on(t.parentId, t.slug),
    index("pages_status_idx").on(t.status),
    index("pages_tenantId_idx").on(t.tenantId),
  ]
)

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    slug: text("slug").notNull(),
    tenantId: text("tenantId")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade", onUpdate: "cascade" }),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    featuredImage: text("featuredImage"),
    data: jsonb("data").notNull().default({}),
    draftData: jsonb("draftData"),
    css: text("css"),
    cssHash: text("cssHash"),
    status: contentStatus("status").notNull().default("DRAFT"),
    publishedAt: timestamp("publishedAt", { precision: 3, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("posts_tenantId_slug_key").on(t.tenantId, t.slug),
    index("posts_status_publishedAt_idx").on(t.status, t.publishedAt),
    index("posts_tenantId_idx").on(t.tenantId),
  ]
)

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug)]
)

export const tags = pgTable(
  "tags",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
  },
  (t) => [uniqueIndex("tags_slug_key").on(t.slug)]
)

// Prisma implicit m2m join tables. Column names (A/B), FK targets, the
// composite PK, and the B-index all match Prisma's convention exactly so the
// existing tables are unchanged. Ordering: A references the alphabetically
// first model. PostCategories → A=Category, B=Post. PostTags → A=Post, B=Tag.
export const postCategories = pgTable(
  "_PostCategories",
  {
    a: text("A")
      .notNull()
      .references(() => categories.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    b: text("B")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [
    primaryKey({ name: "_PostCategories_AB_pkey", columns: [t.a, t.b] }),
    index("_PostCategories_B_index").on(t.b),
  ]
)

export const postTags = pgTable(
  "_PostTags",
  {
    a: text("A")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade", onUpdate: "cascade" }),
    b: text("B")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade", onUpdate: "cascade" }),
  },
  (t) => [
    primaryKey({ name: "_PostTags_AB_pkey", columns: [t.a, t.b] }),
    index("_PostTags_B_index").on(t.b),
  ]
)

export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    tenantId: text("tenantId").references(() => tenants.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
    slug: text("slug").notNull(),
    kind: templateKind("kind").notNull(),
    area: text("area"),
    synced: boolean("synced").notNull().default(false),
    title: text("title").notNull(),
    description: text("description"),
    data: jsonb("data").notNull().default({}),
    draftData: jsonb("draftData"),
    css: text("css"),
    cssHash: text("cssHash"),
    preview: text("preview"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("templates_tenantId_slug_key").on(t.tenantId, t.slug),
    index("templates_tenantId_kind_idx").on(t.tenantId, t.kind),
    // Partial unique: one global template per slug (tenantId IS NULL).
    uniqueIndex("templates_global_slug_key")
      .on(t.slug)
      .where(sql`${t.tenantId} IS NULL`),
  ]
)

export const redirects = pgTable(
  "redirects",
  {
    id: text("id").primaryKey().$defaultFn(cuid),
    fromPath: text("fromPath").notNull(),
    toPath: text("toPath").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("redirects_fromPath_key").on(t.fromPath)]
)

// ── Relations ────────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many }) => ({
  pages: many(pages),
  posts: many(posts),
  templates: many(templates),
  chromeAssignments: many(chromeAssignments),
}))

export const chromeAssignmentsRelations = relations(
  chromeAssignments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [chromeAssignments.tenantId],
      references: [tenants.id],
    }),
  })
)

export const pagesRelations = relations(pages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [pages.tenantId],
    references: [tenants.id],
  }),
  parent: one(pages, {
    fields: [pages.parentId],
    references: [pages.id],
    relationName: "PageTree",
  }),
  children: many(pages, { relationName: "PageTree" }),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [posts.tenantId],
    references: [tenants.id],
  }),
  categories: many(postCategories),
  tags: many(postTags),
}))

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(postCategories),
}))

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}))

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
  category: one(categories, {
    fields: [postCategories.a],
    references: [categories.id],
  }),
  post: one(posts, {
    fields: [postCategories.b],
    references: [posts.id],
  }),
}))

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.a],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.b],
    references: [tags.id],
  }),
}))

export const templatesRelations = relations(templates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [templates.tenantId],
    references: [tenants.id],
  }),
}))

export type ContentStatus = (typeof contentStatus.enumValues)[number]
export type TemplateKind = (typeof templateKind.enumValues)[number]

export type Tenant = typeof tenants.$inferSelect
export type ChromeAssignment = typeof chromeAssignments.$inferSelect
export type Page = typeof pages.$inferSelect
export type Post = typeof posts.$inferSelect
export type Category = typeof categories.$inferSelect
export type Tag = typeof tags.$inferSelect
export type Template = typeof templates.$inferSelect
export type Redirect = typeof redirects.$inferSelect
