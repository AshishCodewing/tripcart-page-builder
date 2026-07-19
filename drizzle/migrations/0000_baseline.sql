CREATE EXTENSION IF NOT EXISTS "vector";--> statement-breakpoint
CREATE TYPE "public"."ContentStatus" AS ENUM('DRAFT', 'PUBLISHED');--> statement-breakpoint
CREATE TYPE "public"."TemplateKind" AS ENUM('LAYOUT', 'PATTERN', 'PART');--> statement-breakpoint
CREATE TYPE "public"."LedgerAccountType" AS ENUM('SYSTEM', 'TENANT');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chrome_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text NOT NULL,
	"segment" text NOT NULL,
	"headerSlug" text,
	"footerSlug" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"path" text NOT NULL,
	"parentId" text,
	"tenantId" text NOT NULL,
	"title" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draftData" jsonb,
	"css" text,
	"cssHash" text,
	"status" "ContentStatus" DEFAULT 'DRAFT' NOT NULL,
	"publishedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "_PostCategories" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_PostCategories_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "_PostTags" (
	"A" text NOT NULL,
	"B" text NOT NULL,
	CONSTRAINT "_PostTags_AB_pkey" PRIMARY KEY("A","B")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"tenantId" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"featuredImage" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draftData" jsonb,
	"css" text,
	"cssHash" text,
	"status" "ContentStatus" DEFAULT 'DRAFT' NOT NULL,
	"publishedAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" text PRIMARY KEY NOT NULL,
	"fromPath" text NOT NULL,
	"toPath" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text,
	"slug" text NOT NULL,
	"kind" "TemplateKind" NOT NULL,
	"area" text,
	"synced" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draftData" jsonb,
	"css" text,
	"cssHash" text,
	"preview" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"domain" text,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"themeVersion" integer DEFAULT 1 NOT NULL,
	"themeCss" text,
	"themeCssHash" text,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_balances" (
	"accountId" text PRIMARY KEY NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text,
	"accountCode" text NOT NULL,
	"accountType" "LedgerAccountType" NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"transactionId" text NOT NULL,
	"accountId" text NOT NULL,
	"amount" bigint NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenantId" text,
	"transactionType" text NOT NULL,
	"referenceType" text,
	"referenceId" text,
	"description" text,
	"idempotencyKey" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_chunk_urls" (
	"id" text PRIMARY KEY NOT NULL,
	"chunkHash" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"lastSeenAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "doc_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"contentHash" text NOT NULL,
	"content" text NOT NULL,
	"headerPath" text NOT NULL,
	"kind" text NOT NULL,
	"tokenCount" integer NOT NULL,
	"embedding" vector(3072) NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chrome_assignments" ADD CONSTRAINT "chrome_assignments_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_parentId_pages_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostCategories" ADD CONSTRAINT "_PostCategories_A_categories_id_fk" FOREIGN KEY ("A") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostCategories" ADD CONSTRAINT "_PostCategories_B_posts_id_fk" FOREIGN KEY ("B") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostTags" ADD CONSTRAINT "_PostTags_A_posts_id_fk" FOREIGN KEY ("A") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "_PostTags" ADD CONSTRAINT "_PostTags_B_tags_id_fk" FOREIGN KEY ("B") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenantId_tenants_id_fk" FOREIGN KEY ("tenantId") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "account_balances" ADD CONSTRAINT "account_balances_accountId_ledger_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_ledger_transactions_id_fk" FOREIGN KEY ("transactionId") REFERENCES "public"."ledger_transactions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_ledger_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "chrome_assignments_tenantId_segment_key" ON "chrome_assignments" USING btree ("tenantId","segment");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_tenantId_path_key" ON "pages" USING btree ("tenantId","path");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_parentId_slug_key" ON "pages" USING btree ("parentId","slug");--> statement-breakpoint
CREATE INDEX "pages_status_idx" ON "pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pages_tenantId_idx" ON "pages" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "_PostCategories_B_index" ON "_PostCategories" USING btree ("B");--> statement-breakpoint
CREATE INDEX "_PostTags_B_index" ON "_PostTags" USING btree ("B");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_tenantId_slug_key" ON "posts" USING btree ("tenantId","slug");--> statement-breakpoint
CREATE INDEX "posts_status_publishedAt_idx" ON "posts" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE INDEX "posts_tenantId_idx" ON "posts" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_fromPath_key" ON "redirects" USING btree ("fromPath");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_key" ON "tags" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_tenantId_slug_key" ON "templates" USING btree ("tenantId","slug");--> statement-breakpoint
CREATE INDEX "templates_tenantId_kind_idx" ON "templates" USING btree ("tenantId","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_global_slug_key" ON "templates" USING btree ("slug") WHERE "templates"."tenantId" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "ledger_accounts_tenantId_idx" ON "ledger_accounts" USING btree ("tenantId");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_tenantId_accountCode_key" ON "ledger_accounts" USING btree ("tenantId","accountCode");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_accounts_system_code_key" ON "ledger_accounts" USING btree ("accountCode") WHERE "ledger_accounts"."tenantId" IS NULL;--> statement-breakpoint
CREATE INDEX "ledger_entries_accountId_idx" ON "ledger_entries" USING btree ("accountId");--> statement-breakpoint
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries" USING btree ("transactionId");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_transactions_idempotencyKey_key" ON "ledger_transactions" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "ledger_transactions_tenantId_idx" ON "ledger_transactions" USING btree ("tenantId");--> statement-breakpoint
CREATE INDEX "ledger_transactions_referenceType_referenceId_idx" ON "ledger_transactions" USING btree ("referenceType","referenceId");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_chunk_urls_chunkHash_url_key" ON "doc_chunk_urls" USING btree ("chunkHash","url");--> statement-breakpoint
CREATE INDEX "doc_chunk_urls_url_idx" ON "doc_chunk_urls" USING btree ("url");--> statement-breakpoint
CREATE UNIQUE INDEX "doc_chunks_contentHash_key" ON "doc_chunks" USING btree ("contentHash");--> statement-breakpoint
-- FK moved to the end: it references doc_chunks."contentHash", whose UNIQUE
-- index is created just above. drizzle-kit emits FKs before indexes, which
-- fails a fresh apply (the referenced unique must exist first); reordered by
-- hand. Harmless on already-baselined DBs, which skip this migration entirely.
ALTER TABLE "doc_chunk_urls" ADD CONSTRAINT "doc_chunk_urls_chunkHash_doc_chunks_contentHash_fk" FOREIGN KEY ("chunkHash") REFERENCES "public"."doc_chunks"("contentHash") ON DELETE cascade ON UPDATE cascade;