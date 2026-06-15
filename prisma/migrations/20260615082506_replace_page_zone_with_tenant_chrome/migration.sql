/*
  Warnings:

  - You are about to drop the column `layoutSlug` on the `pages` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "pages" DROP COLUMN "layoutSlug";

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "footerTemplateId" TEXT,
ADD COLUMN     "headerTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_headerTemplateId_fkey" FOREIGN KEY ("headerTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_footerTemplateId_fkey" FOREIGN KEY ("footerTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
