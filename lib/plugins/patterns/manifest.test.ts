import { describe, expect, it } from "vitest"

import {
  BUILTIN_PATTERNS,
  aboutDescriptor,
  cardDescriptors,
  ctaDescriptor,
  destinationPageDescriptor,
  heroDescriptors,
  pricingPageDescriptor,
  testimonialDescriptor,
  tripsDescriptor,
} from "./manifest"

describe("pattern manifest", () => {
  it("has unique block ids", () => {
    const ids = BUILTIN_PATTERNS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("aggregates every per-pattern descriptor (the registrations consume these)", () => {
    const expected = [
      ...heroDescriptors,
      aboutDescriptor,
      ctaDescriptor,
      ...cardDescriptors,
      testimonialDescriptor,
      tripsDescriptor,
      destinationPageDescriptor,
      pricingPageDescriptor,
    ]
    // Same set of ids in the aggregate as across the individual descriptors —
    // guards against adding a descriptor without listing it (or vice versa).
    expect(new Set(BUILTIN_PATTERNS.map((p) => p.id))).toEqual(
      new Set(expected.map((p) => p.id))
    )
  })

  it("every descriptor has a label and category", () => {
    for (const p of BUILTIN_PATTERNS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.category.length).toBeGreaterThan(0)
    }
  })
})
