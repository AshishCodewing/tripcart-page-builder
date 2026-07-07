import { AccountNotFoundError, balances, UNITS_PER_CREDIT } from "@/lib/ledger"

// Wallet balance for the editor's credit readout (components/ai/chat.tsx).
// TODO(auth): tenantId is client-supplied — switch to server-side tenant
// resolution once the routes have a session.
export async function GET(request: Request) {
  const tenantId = new URL(request.url).searchParams.get("tenantId")
  if (!tenantId) {
    return Response.json({ error: "tenantId is required" }, { status: 400 })
  }
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
