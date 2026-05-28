-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('LAYOUT', 'PATTERN', 'PART');

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "slug" TEXT NOT NULL,
    "kind" "TemplateKind" NOT NULL,
    "area" TEXT,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "preview" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "templates_tenantId_kind_idx" ON "templates"("tenantId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "templates_tenantId_slug_key" ON "templates"("tenantId", "slug");

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique index: globals (tenantId IS NULL) must have unique slugs.
-- Not expressible via Prisma's @@unique; see schema.prisma comment on Template.
CREATE UNIQUE INDEX "templates_global_slug_key" ON "templates"("slug") WHERE "tenantId" IS NULL;
