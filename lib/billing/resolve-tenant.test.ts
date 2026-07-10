import { beforeEach, describe, expect, it, vi } from "vitest"

import { prisma } from "@/lib/prisma"

import { resolveBilledTenant } from "./resolve-tenant"

vi.mock("@/lib/prisma", () => ({
  prisma: { tenant: { findUnique: vi.fn() } },
}))

const findUnique = vi.mocked(prisma.tenant.findUnique)

describe("resolveBilledTenant", () => {
  beforeEach(() => {
    findUnique.mockReset()
  })

  it("returns an unmetered null for a non-string candidate", async () => {
    await expect(resolveBilledTenant(undefined)).resolves.toEqual({
      tenantId: null,
    })
    await expect(resolveBilledTenant(123)).resolves.toEqual({ tenantId: null })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("returns an unmetered null for an empty string (no DB lookup)", async () => {
    await expect(resolveBilledTenant("")).resolves.toEqual({ tenantId: null })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("rejects an over-long candidate without hitting the DB", async () => {
    await expect(resolveBilledTenant("x".repeat(201))).resolves.toEqual({
      error: "unknown_tenant",
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("rejects a candidate that names no real tenant", async () => {
    findUnique.mockResolvedValue(null as never)
    await expect(resolveBilledTenant("ghost")).resolves.toEqual({
      error: "unknown_tenant",
    })
  })

  it("resolves a known tenant to its id", async () => {
    findUnique.mockResolvedValue({ id: "tenant-1" } as never)
    await expect(resolveBilledTenant("tenant-1")).resolves.toEqual({
      tenantId: "tenant-1",
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "tenant-1" },
      select: { id: true },
    })
  })
})
