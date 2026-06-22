import { describe, expect, it } from "vitest"

import { Prisma } from "@/generated/prisma/client"

import { computePublishTimestamp } from "./publish-timestamp"
import { buildDraftDataUpdate } from "./draft-data"
import { parseOptionalProjectData } from "./parse-body"

describe("computePublishTimestamp", () => {
  const existing = new Date("2020-01-01T00:00:00Z")

  it("stamps now only on the DRAFT→PUBLISHED transition", () => {
    const result = computePublishTimestamp(false, true, null)
    expect(result).toBeInstanceOf(Date)
    expect(result).not.toBeNull()
  })

  it("preserves the existing timestamp when already published", () => {
    expect(computePublishTimestamp(true, true, existing)).toBe(existing)
  })

  it("preserves the existing timestamp when unpublishing", () => {
    expect(computePublishTimestamp(true, false, existing)).toBe(existing)
  })

  it("stays null while a draft remains a draft", () => {
    expect(computePublishTimestamp(false, false, null)).toBeNull()
  })
})

describe("buildDraftDataUpdate", () => {
  it("clears the draft when data is committed", () => {
    const data = { pages: [] }
    expect(buildDraftDataUpdate(data)).toEqual({
      data,
      draftData: Prisma.DbNull,
    })
  })

  it("is an empty fragment for metadata-only saves", () => {
    expect(buildDraftDataUpdate(undefined)).toEqual({})
  })
})

describe("parseOptionalProjectData", () => {
  it("returns undefined when the data field is absent", () => {
    expect(parseOptionalProjectData(new FormData())).toBeUndefined()
  })

  it("returns undefined when the data field is empty", () => {
    const form = new FormData()
    form.set("data", "")
    expect(parseOptionalProjectData(form)).toBeUndefined()
  })
})
