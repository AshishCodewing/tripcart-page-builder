-- CreateTable
CREATE TABLE "chrome_assignments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "headerSlug" TEXT,
    "footerSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chrome_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chrome_assignments_tenantId_segment_key" ON "chrome_assignments"("tenantId", "segment");

-- AddForeignKey
ALTER TABLE "chrome_assignments" ADD CONSTRAINT "chrome_assignments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
