/*
  Warnings:

  - You are about to drop the column `publishedAt` on the `templates` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "templates" DROP COLUMN "publishedAt",
DROP COLUMN "status";
