/**
 * Pure balance math — the unit-testable heart of the ledger. No DB, no I/O,
 * no mutation of the caller's array; same input always yields the same output.
 * The validator and service call these; the rules and locking live there.
 */
import type { LedgerEntryInput } from "./types"

/**
 * Sum the signed amounts of a transaction's entries. A balanced transaction
 * sums to `0n` (invariant 2). An empty array sums to `0n` (the seed).
 */
export function sumEntries(entries: LedgerEntryInput[]): bigint {
  return entries.reduce((total, entry) => total + entry.amount, 0n)
}

/**
 * Net change per account for a transaction. An account may appear in more than
 * one entry, so amounts are accumulated, not overwritten. The service uses this
 * to know which balance rows to lock and by how much to move them.
 */
export function computeDeltas(
  entries: LedgerEntryInput[]
): Map<string, bigint> {
  const deltas = new Map<string, bigint>()
  for (const entry of entries) {
    const current = deltas.get(entry.accountId) ?? 0n
    deltas.set(entry.accountId, current + entry.amount)
  }
  return deltas
}
