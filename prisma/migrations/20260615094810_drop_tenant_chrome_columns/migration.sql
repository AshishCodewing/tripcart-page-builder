/*
  Warnings:

  - You are about to drop the column `footerTemplateId` on the `tenants` table. All the data in the column will be lost.
  - You are about to drop the column `headerTemplateId` on the `tenants` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "tenants" DROP CONSTRAINT "tenants_footerTemplateId_fkey";

-- DropForeignKey
ALTER TABLE "tenants" DROP CONSTRAINT "tenants_headerTemplateId_fkey";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "footerTemplateId",
DROP COLUMN "headerTemplateId";
