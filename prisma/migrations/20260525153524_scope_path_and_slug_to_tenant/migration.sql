-- DropIndex
DROP INDEX "pages_path_key";

-- DropIndex
DROP INDEX "posts_slug_key";

-- CreateIndex
CREATE UNIQUE INDEX "pages_tenantId_path_key" ON "pages"("tenantId", "path");

-- CreateIndex
CREATE UNIQUE INDEX "posts_tenantId_slug_key" ON "posts"("tenantId", "slug");
