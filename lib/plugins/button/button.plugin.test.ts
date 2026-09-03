// @vitest-environment jsdom
import grapesjs, { type ComponentDefinition, type Editor } from "grapesjs"
import { afterEach, describe, expect, it } from "vitest"

import { ELEMENT_BUTTON_CLASS } from "@/lib/theme/style-selectors"

import { BUTTON_TYPE, buttonPlugin } from "./index"

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function init(): Editor {
  editor = grapesjs.init({
    headless: true,
    storageManager: false,
    plugins: [buttonPlugin],
  })
  return editor
}

function dropBlock(ed: Editor) {
  const block = ed.Blocks.get(BUTTON_TYPE)
  ed.addComponents(block.getContent() as ComponentDefinition)
  return ed.getWrapper()!.findType(BUTTON_TYPE)[0]!
}

describe("tc-button plugin", () => {
  it("drops as an <a> wearing the type and element-button classes, Fill by default", () => {
    const ed = init()
    const button = dropBlock(ed)

    expect(button.get("tagName")).toBe("a")
    expect(button.getClasses()).toEqual(
      expect.arrayContaining(["tc-button", ELEMENT_BUTTON_CLASS])
    )
    expect(button.getClasses()).not.toContain("is-style-outline")
    expect(button.get("variant")).toBe("fill")
    expect(button.getInnerHTML()).toContain("Book now")
  })

  it("exposes the link traits plus the variant select", () => {
    const ed = init()
    const button = dropBlock(ed)
    const names = button.getTraits().map((t) => t.getName())
    expect(names).toEqual(
      expect.arrayContaining(["href", "target", "title", "variant"])
    )
  })

  it("toggles is-style-outline from the variant trait", () => {
    const ed = init()
    const button = dropBlock(ed)

    button.set("variant", "outline")
    expect(button.getClasses()).toContain("is-style-outline")

    button.set("variant", "fill")
    expect(button.getClasses()).not.toContain("is-style-outline")
  })

  it("re-identifies parsed HTML, restores the variant and the marker class", () => {
    const ed = init()
    ed.addComponents(
      `<a class="tc-button is-style-outline" href="/tours">Browse</a>`
    )
    const button = ed.getWrapper()!.findType(BUTTON_TYPE)[0]!

    expect(button.get("variant")).toBe("outline")
    expect(button.getClasses()).toContain(ELEMENT_BUTTON_CLASS)
    expect(button.getAttributes().href).toBe("/tours")
  })

  it("leaves a plain link alone", () => {
    const ed = init()
    ed.addComponents(`<a href="/x">plain</a>`)
    expect(ed.getWrapper()!.findType(BUTTON_TYPE)).toHaveLength(0)
    expect(ed.getWrapper()!.findType("link")).toHaveLength(1)
  })

  it("ships only zero-specificity :where() rules for .tc-button", () => {
    const ed = init()
    dropBlock(ed)
    const css = ed.getCss() ?? ""

    expect(css).toContain(":where(.tc-button)")
    // A bare `.tc-button {` rule would carry 0-1-0 and fight the theme.
    expect(css).not.toMatch(/(^|[\s},])\.tc-button\s*\{/)
  })
})
