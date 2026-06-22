// Builds the ChromeAssignment reconciliation ops for a header/footer PART
// edit (§Part editor "Used on"). Returns un-awaited PrismaPromises for the
// caller to feed into prisma.$transaction([...]) — building ≠ executing, so
// the transaction boundary stays in the server action.

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

// `selected` is the set of hierarchy slugs this part should be the chrome for.
// We reconcile by the part's own slug against its area's column (header or
// footer).
export function buildChromeAssignmentOps(
  tenantId: string,
  slug: string,
  area: "header" | "footer",
  selected: string[]
): Prisma.PrismaPromise<unknown>[] {
  const isHeader = area === "header"
  const setData = isHeader ? { headerSlug: slug } : { footerSlug: slug }
  const clearData = isHeader ? { headerSlug: null } : { footerSlug: null }
  const notSelected =
    selected.length > 0 ? { segment: { notIn: selected } } : {}

  return [
    // Set this part as the chrome for each selected template.
    ...selected.map((segment) =>
      prisma.chromeAssignment.upsert({
        where: { tenantId_segment: { tenantId, segment } },
        create: { tenantId, segment, ...setData },
        update: setData,
      })
    ),
    // Drop templates that pointed here but are no longer selected back to the
    // fallback chain (clear only this part's column).
    prisma.chromeAssignment.updateMany({
      where: { tenantId, ...setData, ...notSelected },
      data: clearData,
    }),
    // Tidy rows that no longer assign either a header or a footer.
    prisma.chromeAssignment.deleteMany({
      where: { tenantId, headerSlug: null, footerSlug: null },
    }),
  ]
}
