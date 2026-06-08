-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "draftData" JSONB;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "draftData" JSONB;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "draftData" JSONB;
