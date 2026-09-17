// @vitest-environment jsdom
import grapesjs, {
  type Component,
  type ComponentDefinition,
  type Editor,
  type Property,
  type PropertyComposite,
} from "grapesjs"
import parserPostCSS from "grapesjs-parser-postcss"
import { afterEach, describe, expect, it } from "vitest"

import { hasHint } from "@/components/page-builder/style-fields/property-hints"

import {
  ANIMATION_FRAME_TYPE,
  ANIMATION_GROUP_TYPE,
  ANIMATION_TYPE,
  GROUPED_CLASS,
  animationPlugin,
} from "./index"
import {
  ANIMATION_SECTOR,
  composeRange,
  composeTimeline,
  parseRange,
  parseTimeline,
} from "./sector"

let editor: Editor | undefined

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

function init(): Editor {
  editor = grapesjs.init({
    headless: true,
    storageManager: false,
    selectorManager: { componentFirst: true },
    styleManager: { sectors: [ANIMATION_SECTOR] },
    // The app's CSS parser, so the type CSS parses as it does in the editor.
    plugins: [parserPostCSS, animationPlugin],
  })
  return editor
}

/** Adds a block's content; returns the frame it drops in. */
function dropFrame(ed: Editor, id: string): Component {
  const block = ed.Blocks.get(id)
  const [added] = ed.addComponents(block.getContent() as ComponentDefinition)
  return added!
}

/** Adds a block's content; returns the Animation / group inside its frame. */
const dropBlock = (ed: Editor, id: string): Component =>
  dropFrame(ed, id).components().at(0)

// GrapesJS refreshes property values and visibility on a 0ms debounce.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

async function select(ed: Editor, target: Component) {
  ed.select(target)
  await tick()
}

const sector = (ed: Editor) => ed.StyleManager.getSector("animation")!

const property = (ed: Editor, name: string): Property =>
  sector(ed)
    .getProperties()
    .find((p) => p.getName() === name)!

/** The rows the panel draws: visible properties, split by the `advanced` hint. */
function rows(ed: Editor) {
  const main: string[] = []
  const advanced: string[] = []
  for (const p of sector(ed).getProperties()) {
    if (p.isVisible()) {
      ;(hasHint(p, "advanced") ? advanced : main).push(p.getName())
    }
  }
  return { main, advanced }
}

/** Sets a composite's parts by name, the way their fields do. */
async function setParts(
  ed: Editor,
  composite: string,
  values: Record<string, string>
) {
  const parts = (property(ed, composite) as PropertyComposite).getProperties()
  for (const [name, value] of Object.entries(values)) {
    parts.find((p) => p.getName() === name)!.upValue(value)
  }
  await tick()
}

describe("tc-animation plugin", () => {
  it("drops a scroll-driven Animation", () => {
    const ed = init()
    const animation = dropBlock(ed, ANIMATION_TYPE)

    expect(animation.get("type")).toBe(ANIMATION_TYPE)
    expect(animation.getClasses()).toContain("tc-animation")
    expect(animation.getStyle()).toMatchObject({
      "animation-name": "tc-fade-in",
      "animation-timeline": "view()",
      "animation-range-start": "entry 0%",
      "animation-range-end": "cover 30%",
    })
    expect(animation.components().at(0)?.get("type")).toBe("text")
  })

  it("drops both blocks inside a clipping frame", () => {
    const ed = init()
    for (const [id, inner] of [
      [ANIMATION_TYPE, ANIMATION_TYPE],
      [ANIMATION_GROUP_TYPE, ANIMATION_GROUP_TYPE],
    ]) {
      const frame = dropFrame(ed, id)
      expect(frame.get("type")).toBe(ANIMATION_FRAME_TYPE)
      expect(frame.getClasses()).toContain("tc-animation-frame")
      expect(frame.components()).toHaveLength(1)
      expect(frame.components().at(0).get("type")).toBe(inner)
    }
    expect(ed.getCss()).toContain(".tc-animation-frame{overflow-x:clip;}")
  })

  it("selects the Animation, not the frame, when a block is dropped", () => {
    const ed = init()
    for (const id of [ANIMATION_TYPE, ANIMATION_GROUP_TYPE]) {
      const frame = dropFrame(ed, id)
      ed.trigger("block:drag:stop", frame, ed.Blocks.get(id))
      expect(ed.getSelected()).toBe(frame.components().at(0))
    }
  })

  it("re-identifies a stored frame", () => {
    const ed = init()
    const [frame] = ed.addComponents(
      '<div class="tc-animation-frame"><div class="tc-animation">A</div></div>'
    )
    expect(frame!.get("type")).toBe(ANIMATION_FRAME_TYPE)
    expect(frame!.components().at(0).get("type")).toBe(ANIMATION_TYPE)
  })

  it("ships the keyframe, group timeline and defaults, and grouped rule", () => {
    const ed = init()
    dropBlock(ed, ANIMATION_TYPE)
    // getCss drops rules nothing on the page matches, so the grouped rule
    // needs a group.
    dropBlock(ed, ANIMATION_GROUP_TYPE)
    const css = ed.getCss() ?? ""

    expect(css).toContain("@keyframes tc-fade-in{from{opacity:0;}}")
    expect(css).not.toContain("--tc-animation-view")
    expect(css).toContain(
      ".tc-animation-group{view-timeline-name:--tc-animation-group;--tc-animation-range-start-name:entry;--tc-animation-range-start-offset:0%;--tc-animation-range-end-name:cover;--tc-animation-range-end-offset:30%;--tc-animation-stagger:10%;}"
    )
    expect(css).toContain(
      ".tc-animation--grouped{animation-timeline:--tc-animation-group;animation-range-start:var(--tc-animation-range-start-name) calc(var(--tc-animation-range-start-offset) + (sibling-index() - 1) * var(--tc-animation-stagger));"
    )
    expect(css).toContain(
      "@media (prefers-reduced-motion: reduce){.tc-animation{animation:none !important;}}"
    )
    expect(css).not.toContain("@supports")
  })

  it("re-identifies stored markup", () => {
    const ed = init()
    const [group] = ed.addComponents(
      '<div class="tc-animation-group"><div class="tc-animation">A</div></div>'
    )

    expect(group!.get("type")).toBe(ANIMATION_GROUP_TYPE)
    const child = group!.components().at(0)
    expect(child.get("type")).toBe(ANIMATION_TYPE)
    expect(child.getClasses()).toContain(GROUPED_CLASS)
  })

  it("drops a group of three grouped Animations with no timeline of their own", () => {
    const ed = init()
    const group = dropBlock(ed, ANIMATION_GROUP_TYPE)
    const children = group.components().models

    expect(children).toHaveLength(3)
    expect(group.get("droppable")).toBe(`[data-gjs-type=${ANIMATION_TYPE}]`)
    for (const child of children) {
      expect(child.get("type")).toBe(ANIMATION_TYPE)
      expect(child.getClasses()).toContain(GROUPED_CLASS)
      expect(child.getStyle()["animation-timeline"]).toBeUndefined()
    }
  })

  it("strips a joining Animation's timeline and range, and unmarks it on leaving", () => {
    const ed = init()
    const group = dropBlock(ed, ANIMATION_GROUP_TYPE)
    const animation = dropBlock(ed, ANIMATION_TYPE)

    group.append(animation.clone())
    const joined = group.components().at(3)
    expect(joined.getClasses()).toContain(GROUPED_CLASS)
    for (const owned of [
      "animation-timeline",
      "animation-range-start",
      "animation-range-end",
    ]) {
      expect(joined.getStyle()).not.toHaveProperty(owned)
    }
    expect(joined.getStyle()["animation-name"]).toBe("tc-fade-in")

    joined.remove()
    expect(joined.getClasses()).not.toContain(GROUPED_CLASS)
  })
})

describe("Animation sector rows", () => {
  it("is hidden for anything that isn't an Animation or group", async () => {
    const ed = init()
    const [text] = ed.addComponents({ type: "text", content: "Hi" })
    await select(ed, text!)
    expect(rows(ed)).toEqual({ main: [], advanced: [] })
    expect(sector(ed).isVisible()).toBe(false)
  })

  it("shows type and timing on an Animation, the rest in Advanced", async () => {
    const ed = init()
    await select(ed, dropBlock(ed, ANIMATION_TYPE))
    expect(rows(ed)).toEqual({
      main: ["animation-name", "animation-timing-function"],
      advanced: [
        "animation-timeline",
        "animation-range-start",
        "animation-range-end",
        "animation-fill-mode",
        "animation-iteration-count",
        "animation-direction",
      ],
    })
  })

  it("reads a dropped Animation's start, end and timeline into their parts", async () => {
    const ed = init()
    await select(ed, dropBlock(ed, ANIMATION_TYPE))
    const parts = (name: string) =>
      (property(ed, name) as PropertyComposite)
        .getProperties()
        .map((p) => [p.getLabel(), String(p.getValue())])

    expect(parts("animation-range-start")).toEqual([
      ["Phase", "entry"],
      ["Offset", "0"],
    ])
    expect(parts("animation-range-end")).toEqual([
      ["Phase", "cover"],
      ["Offset", "30"],
    ])
    expect(parts("animation-timeline")).toEqual([
      ["Driven by", "view"],
      ["Axis", "block"],
      ["Inset start", "auto"],
      ["Inset end", "auto"],
    ])
  })

  it("writes every timeline form", async () => {
    const ed = init()
    const animation = dropBlock(ed, ANIMATION_TYPE)
    await select(ed, animation)
    const timeline = () => animation.getStyle()["animation-timeline"]

    await setParts(ed, "animation-timeline", {
      "animation-timeline-axis": "inline",
      "animation-timeline-inset-start": "10",
      "animation-timeline-inset-end": "20",
    })
    expect(timeline()).toBe("view(inline 10% 20%)")

    await setParts(ed, "animation-timeline", {
      "animation-timeline-source": "root",
    })
    expect(timeline()).toBe("scroll(root inline)")

    await setParts(ed, "animation-timeline", {
      "animation-timeline-source": "auto",
    })
    expect(timeline()).toBe("auto")

    await setParts(ed, "animation-timeline", {
      "animation-timeline-source": "none",
    })
    expect(timeline()).toBe("none")
  })

  it("writes start and end as their real properties", async () => {
    const ed = init()
    const animation = dropBlock(ed, ANIMATION_TYPE)
    await select(ed, animation)

    await setParts(ed, "animation-range-start", {
      "animation-range-start-phase": "contain",
      "animation-range-start-offset": "15",
    })
    expect(animation.getStyle()["animation-range-start"]).toBe("contain 15%")
    expect(animation.getStyle()).not.toHaveProperty(
      "animation-range-start-phase"
    )
  })

  it("leaves timeline and range to the group on a grouped Animation", async () => {
    const ed = init()
    const group = dropBlock(ed, ANIMATION_GROUP_TYPE)
    await select(ed, group.components().at(0))
    expect(rows(ed)).toEqual({
      main: ["animation-name", "animation-timing-function"],
      advanced: [
        "animation-fill-mode",
        "animation-iteration-count",
        "animation-direction",
      ],
    })
  })

  it("shows stagger on a group, its timeline and range in Advanced", async () => {
    const ed = init()
    await select(ed, dropBlock(ed, ANIMATION_GROUP_TYPE))
    expect(rows(ed)).toEqual({
      main: ["--tc-animation-stagger"],
      advanced: [
        "view-timeline-axis",
        "--tc-animation-range-start",
        "--tc-animation-range-end",
      ],
    })
  })

  it("writes a group's start and stagger as the properties its children read", async () => {
    const ed = init()
    const group = dropBlock(ed, ANIMATION_GROUP_TYPE)
    await select(ed, group)
    await setParts(ed, "--tc-animation-range-start", {
      "--tc-animation-range-start-offset": "15",
    })
    property(ed, "--tc-animation-stagger").upValue("25")
    await tick()

    expect(group.getStyle()).toMatchObject({
      "--tc-animation-range-start-offset": "15%",
      "--tc-animation-stagger": "25%",
    })
  })

  it("writes a group's timeline axis and inset, and reads an inset back", async () => {
    const ed = init()
    const group = dropBlock(ed, ANIMATION_GROUP_TYPE)
    await select(ed, group)
    await setParts(ed, "view-timeline-axis", {
      "view-timeline-part-inset-start": "5",
      "view-timeline-part-inset-end": "10",
    })
    expect(group.getStyle()).toMatchObject({
      "view-timeline-axis": "block",
      "view-timeline-inset": "5% 10%",
    })

    await select(ed, ed.getWrapper()!)
    await select(ed, group)
    const insetStart = (property(ed, "view-timeline-axis") as PropertyComposite)
      .getProperties()
      .find((p) => p.getName() === "view-timeline-part-inset-start")!
    expect(String(insetStart.getValue())).toBe("5")
  })
})

describe("timeline value round-trip", () => {
  it("composes every form", () => {
    expect(composeTimeline({})).toBe("view()")
    expect(composeTimeline({ axis: "x" })).toBe("view(x)")
    expect(composeTimeline({ insetStart: "10%", insetEnd: "auto" })).toBe(
      "view(10% auto)"
    )
    expect(composeTimeline({ source: "nearest" })).toBe("scroll()")
    expect(composeTimeline({ source: "self", axis: "inline" })).toBe(
      "scroll(self inline)"
    )
    // A scroll timeline has no inset.
    expect(composeTimeline({ source: "root", insetStart: "10%" })).toBe(
      "scroll(root)"
    )
    expect(composeTimeline({ source: "auto" })).toBe("auto")
    expect(composeTimeline({ source: "none" })).toBe("none")
  })

  it("parses every form, in any token order", () => {
    expect(parseTimeline("view(20px inline 10%)")).toEqual({
      source: "view",
      axis: "inline",
      insetStart: "20px",
      insetEnd: "10%",
    })
    expect(parseTimeline("view(15%)")).toMatchObject({
      insetStart: "15%",
      insetEnd: "15%",
    })
    expect(parseTimeline("scroll(y root)")).toMatchObject({
      source: "root",
      axis: "y",
    })
    expect(parseTimeline("scroll()")).toMatchObject({
      source: "nearest",
      axis: "block",
    })
    expect(parseTimeline("auto")).toMatchObject({ source: "auto" })
    expect(parseTimeline("none")).toMatchObject({ source: "none" })
    expect(parseTimeline("--tc-animation-group")).toBeNull()
  })
})

describe("range value round-trip", () => {
  it("composes and parses ranges", () => {
    expect(composeRange("entry", "25%")).toBe("entry 25%")
    expect(composeRange("cover", "")).toBe("cover 0%")
    expect(parseRange("exit-crossing 40px", "0%")).toEqual({
      phase: "exit-crossing",
      offset: "40px",
    })
    expect(parseRange("cover", "100%")).toEqual({
      phase: "cover",
      offset: "100%",
    })
    expect(parseRange("normal", "0%")).toBeNull()
  })
})
