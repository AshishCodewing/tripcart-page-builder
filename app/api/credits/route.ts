import { resolveBilledTenant } from "@/lib/billing/resolve-tenant"
import { AccountNotFoundError, balances, UNITS_PER_CREDIT } from "@/lib/ledger"

// Wallet balance for the editor's credit readout (components/ai/chat.tsx).
// TODO(auth): tenantId is client-supplied — resolved by
// lib/billing/resolve-tenant.ts (the single seam for future session auth).
export async function GET(request: Request) {
  // A cosmetic readout: an unknown/absent tenant returns `{credits: null}`
  // (200), not a 4xx, so status codes can't be used to probe which tenant ids
  // exist. Revisit this trade-off once real auth lands.
  const candidate = new URL(request.url).searchParams.get("tenantId")
  const resolved = await resolveBilledTenant(candidate)
  if ("error" in resolved || resolved.tenantId === null) {
    return Response.json({ credits: null })
  }
  const tenantId = resolved.tenantId
  try {
    const units = await balances.getWalletBalance(tenantId)
    return Response.json({ credits: Number(units / UNITS_PER_CREDIT) })
  } catch (e) {
    // No wallet yet — the billing gate seeds it on first AI use; until then
    // there's simply nothing to show.
    if (e instanceof AccountNotFoundError) {
      return Response.json({ credits: null })
    }
    console.error(`[billing] credit read failed for tenant ${tenantId}:`, e)
    return Response.json({ error: "Failed to read balance" }, { status: 500 })
  }
}
