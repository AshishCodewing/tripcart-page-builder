// @vitest-environment jsdom
import grapesjs, { type ComponentDefinition, type Editor } from "grapesjs"
import { afterEach, describe, expect, it } from "vitest"

import {
  HEADING_TYPE,
  headingLevel,
  headingPlugin,
  isHeading,
  setHeadingLevel,
  toHeadingLevel,
} from "./index"

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function init(): Editor {
  editor = grapesjs.init({
    headless: true,
    storageManager: false,
    plugins: [headingPlugin],
  })
  return editor
}

function dropBlock(ed: Editor) {
  const block = ed.Blocks.get(HEADING_TYPE)
  ed.addComponents(block.getContent() as ComponentDefinition)
  return ed.getWrapper()!.findType(HEADING_TYPE)[0]!
}

describe("tc-heading plugin", () => {
  it("drops as an editable <h2> wearing the marker class", () => {
    const ed = init()
    const heading = dropBlock(ed)

    expect(heading.get("tagName")).toBe("h2")
    expect(heading.getClasses()).toContain("tc-heading")
    expect(heading.get("editable")).toBe(true)
    expect(headingLevel(heading)).toBe(2)
    expect(heading.getInnerHTML()).toContain("Insert your heading here")
  })

  it("exposes the level select as its only trait", () => {
    const ed = init()
    const trait = dropBlock(ed).getTraits()[0]!

    expect(trait.getName()).toBe("level")
    expect(trait.getLabel()).toBe("Size")
    expect(trait.getOptions().map((o) => trait.getOptionId(o))).toEqual([
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
    ])
  })

  it("swaps the tag when the level trait changes", () => {
    const ed = init()
    const heading = dropBlock(ed)

    heading.getTraits()[0]!.setValue("4")

    expect(headingLevel(heading)).toBe(4)
    expect(heading.get("tagName")).toBe("h4")
    // The trait writes the option id (a string); the model keeps a number.
    expect(heading.get("level")).toBe(4)
  })

  it("reads the level back off parsed markup", () => {
    const ed = init()
    ed.addComponents(`<h5 class="tc-heading">Included</h5>`)
    const heading = ed.getWrapper()!.findType(HEADING_TYPE)[0]!

    expect(headingLevel(heading)).toBe(5)
    expect(heading.get("tagName")).toBe("h5")
  })

  it("leaves a plain heading alone", () => {
    const ed = init()
    ed.addComponents(`<h2>Pattern heading</h2>`)

    expect(ed.getWrapper()!.findType(HEADING_TYPE)).toHaveLength(0)
  })

  it("setHeadingLevel applies straight away when nothing is being edited", () => {
    const ed = init()
    const heading = dropBlock(ed)

    setHeadingLevel(ed, heading, 1)

    expect(heading.get("tagName")).toBe("h1")
  })

  it("clamps out-of-range and non-numeric levels to the default", () => {
    expect(toHeadingLevel("3")).toBe(3)
    expect(toHeadingLevel(7)).toBe(2)
    expect(toHeadingLevel("nonsense")).toBe(2)
  })

  it("isHeading only claims the heading type", () => {
    const ed = init()
    ed.addComponents(`<p>text</p>`)

    expect(isHeading(dropBlock(ed))).toBe(true)
    expect(isHeading(ed.getWrapper()!.components().at(0))).toBe(false)
    expect(isHeading(null)).toBe(false)
  })
})
