import { afterEach, describe, expect, it, vi } from "vitest"

import { themeStore } from "@/lib/theme/theme-store"
import type { StyleTarget } from "@/lib/theme/style-targets"
import { defaultTheme } from "@/lib/tokens"

const BUTTON: StyleTarget = { kind: "element", name: "button" }

afterEach(() => {
  themeStore.resetTheme()
})

describe("themeStore.setStyleValue", () => {
  it("updates the theme and notifies subscribers once", () => {
    const listener = vi.fn()
    const unsubscribe = themeStore.subscribe(listener)

    themeStore.setStyleValue(BUTTON, ["color", "background"], "hotpink")

    expect(listener).toHaveBeenCalledTimes(1)
    expect(
      themeStore.getTheme().styles?.elements?.button?.color?.background
    ).toBe("hotpink")
    unsubscribe()
  })

  it("does not emit when the value is unchanged", () => {
    const current =
      defaultTheme.styles?.elements?.button?.color?.background ?? ""
    const listener = vi.fn()
    const unsubscribe = themeStore.subscribe(listener)

    themeStore.setStyleValue(BUTTON, ["color", "background"], current)

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it("leaves the active preset selection alone", () => {
    const before = themeStore.getActivePresetId()
    themeStore.setStyleValue(BUTTON, ["color", "background"], "hotpink")
    expect(themeStore.getActivePresetId()).toBe(before)
  })

  it("resets a whole block to the bundled defaults in one emit", () => {
    themeStore.setStyleValue(BUTTON, ["color", "background"], "hotpink")
    themeStore.setStyleValue(
      { ...BUTTON, variation: "outline" },
      ["color", "text"],
      "hotpink"
    )
    const listener = vi.fn()
    const unsubscribe = themeStore.subscribe(listener)

    themeStore.resetStyleBlock({ ...BUTTON, variation: "outline" })

    expect(listener).toHaveBeenCalledTimes(1)
    expect(themeStore.getTheme().styles?.elements?.button).toEqual(
      defaultTheme.styles?.elements?.button
    )
    unsubscribe()
  })

  it("clears a declaration when given undefined", () => {
    themeStore.setStyleValue(BUTTON, ["color", "background"], undefined)
    expect(
      themeStore.getTheme().styles?.elements?.button?.color?.background
    ).toBeUndefined()
  })
})
