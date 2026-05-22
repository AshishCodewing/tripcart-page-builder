-- This migration intentionally wipes all existing pages and posts.
-- Tenancy becomes required (pages.tenantId / posts.tenantId NOT NULL),
-- and per the user's instruction any rows created before tenancy was
-- enforced are discarded rather than backfilled. Recreate content
-- after the migration applies. Categories, Tags, Redirects, and
-- Tenants themselves are preserved.

TRUNCATE TABLE "pages", "posts" RESTART IDENTITY CASCADE;

-- DropForeignKey
ALTER TABLE "pages" DROP CONSTRAINT "pages_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "posts" DROP CONSTRAINT "posts_tenantId_fkey";

-- AlterTable
ALTER TABLE "pages" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable
ALTER TABLE "posts" ALTER COLUMN "tenantId" SET NOT NULL;

-- AlterTable: tenants.theme holds the full Theme document defined in
-- lib/theme/schema.ts. `{}` means "use the bundled defaultTheme."
ALTER TABLE "tenants" ADD COLUMN     "theme" JSONB NOT NULL DEFAULT '{}';

-- AddForeignKey: ON DELETE CASCADE — deleting a tenant deletes its
-- pages and posts. (Previously SetNull, which is invalid for a NOT
-- NULL column.)
ALTER TABLE "pages" ADD CONSTRAINT "pages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
