// Reconciles the ChromeAssignment rows for a header/footer PART edit (§Part
// editor "Used on"). Runs the upsert/clear/tidy sequence inside a caller-owned
// Drizzle transaction — Drizzle has no array-of-promises `$transaction`, so the
// transaction boundary is the `db.transaction(...)` callback in the action.

import { and, eq, isNull, notInArray } from "drizzle-orm"

import type { Transaction } from "@/lib/db"
import { chromeAssignments } from "@/lib/schema"

// `selected` is the set of hierarchy slugs this part should be the chrome for.
// We reconcile by the part's own slug against its area's column (header or
// footer).
export async function reconcileChromeAssignments(
  tx: Transaction,
  tenantId: string,
  slug: string,
  area: "header" | "footer",
  selected: string[]
): Promise<void> {
  const isHeader = area === "header"
  const ownerCol = isHeader
    ? chromeAssignments.headerSlug
    : chromeAssignments.footerSlug
  const setData = isHeader ? { headerSlug: slug } : { footerSlug: slug }
  const clearData = isHeader ? { headerSlug: null } : { footerSlug: null }

  // Set this part as the chrome for each selected template.
  for (const segment of selected) {
    await tx
      .insert(chromeAssignments)
      .values({ tenantId, segment, ...setData })
      .onConflictDoUpdate({
        target: [chromeAssignments.tenantId, chromeAssignments.segment],
        set: setData,
      })
  }

  // Drop templates that pointed here but are no longer selected back to the
  // fallback chain (clear only this part's column). Filters on the column
  // already equal to this slug, so other parts' assignments are untouched.
  await tx
    .update(chromeAssignments)
    .set(clearData)
    .where(
      and(
        eq(chromeAssignments.tenantId, tenantId),
        eq(ownerCol, slug),
        selected.length > 0
          ? notInArray(chromeAssignments.segment, selected)
          : undefined
      )
    )

  // Tidy rows that no longer assign either a header or a footer.
  await tx
    .delete(chromeAssignments)
    .where(
      and(
        eq(chromeAssignments.tenantId, tenantId),
        isNull(chromeAssignments.headerSlug),
        isNull(chromeAssignments.footerSlug)
      )
    )
}
