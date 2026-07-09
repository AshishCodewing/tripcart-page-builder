-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "css" TEXT,
ADD COLUMN     "cssHash" TEXT;

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "css" TEXT,
ADD COLUMN     "cssHash" TEXT;

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "css" TEXT,
ADD COLUMN     "cssHash" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "themeCss" TEXT,
ADD COLUMN     "themeCssHash" TEXT;
