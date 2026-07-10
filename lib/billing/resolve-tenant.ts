/**
 * THE seam where the billed tenant is decided. Today the candidate comes
 * from the client (TODO(auth): replace with session-derived resolution —
 * this function is the single point to change). What it already enforces:
 * the id must be a non-empty string and must name a REAL tenant, so
 * arbitrary strings can't be metered, can't create junk wallets via the
 * gate's self-heal, and can't probe balances. null ⇒ unmetered run
 * (legitimate for global template editing).
 */
import { prisma } from "@/lib/prisma"

export async function resolveBilledTenant(
  candidate: unknown
): Promise<{ tenantId: string | null } | { error: "unknown_tenant" }> {
  if (typeof candidate !== "string" || candidate.length === 0)
    return { tenantId: null }
  if (candidate.length > 200) return { error: "unknown_tenant" }
  const tenant = await prisma.tenant.findUnique({
    where: { id: candidate },
    select: { id: true },
  })
  return tenant ? { tenantId: tenant.id } : { error: "unknown_tenant" }
}
