// Animation blocks — `tc-animation` (a wrapper that animates whatever is dropped
// inside it) and `tc-animation-group` (plays its Animation children one after
// another). Modeled on the Studio SDK's `animationComponent`, but CSS only:
// nothing ships to the page except CSS.
//
// Animations are scroll-driven: `animation-timeline` follows the element
// through the viewport, so the animation plays as you scroll down, rewinds as
// you scroll up, and holds where you stop.
//
// Split of responsibilities:
//   • The Style Manager's "Animation" sector (./sector.ts) writes REAL CSS on the
//     component's own rule: animation-name, -timing-function, -range-start, …
//     — what the author sets is what the code shows.
//   • This plugin owns the STRUCTURE the sector can't express per component: the
//     group's timeline, the fade-in keyframe, the grouped-child rule, the frame
//     and the reduced-motion fallback.
//
// Keyframes are Open Props' (`slide-in-up`, `scale-up`, …), loaded on every
// content surface via CONTENT_STYLE_URLS. Its `fade-in` only declares `to`, so
// on a fully opaque element it animates 1 → 1; `tc-fade-in` supplies the
// missing `from` and stands in for it.
//
// Groups: the group names a view timeline too; each child it holds wears
// `tc-animation--grouped`, which points the child at that timeline and pushes
// its range later by `sibling-index()` stagger steps. The group's range and
// stagger live on the group as custom properties (a CSS-variable bridge — our
// block CSS stays single-class, see the flat-selector rule) because a child's
// range is "the group's range + my index", which no single real property can
// hold. Their defaults sit on the group's class rule: the author's values land
// on the group's id rule and win, and a nested group re-declares them instead of
// inheriting its outer group's. Joining a group strips the child's own timeline
// and range so its id rule can't outrank the grouped rule.
//
// Both blocks drop inside an Animation Frame, a wrapper with `overflow-x: clip`,
// so a slide starting off to one side can't widen the page.
//
// Browsers without scroll timelines (Firefox, today) ignore the timeline and run
// the animation on page load with no duration: it shows its final frame, i.e.
// the content in place. The keyframe list only offers animations whose final
// frame leaves the content visible (./sector.ts), so no `@supports` fallback
// is needed.

import type { Component, Editor, Plugin } from "grapesjs"

export const ANIMATION_TYPE = "tc-animation"
export const ANIMATION_GROUP_TYPE = "tc-animation-group"
export const ANIMATION_FRAME_TYPE = "tc-animation-frame"

const ANIMATION_CLASS = "tc-animation"
export const GROUPED_CLASS = "tc-animation--grouped"
const GROUP_CLASS = "tc-animation-group"
const FRAME_CLASS = "tc-animation-frame"

/** The view timeline a group publishes to its children. */
export const GROUP_TIMELINE = "--tc-animation-group"

/**
 * A child's own declarations the grouped rule supplies instead, removed when it
 * joins a group.
 */
export const GROUP_OWNED_PROPERTIES = [
  "animation-timeline",
  "animation-range-start",
  "animation-range-end",
]

export const isAnimation = (component?: Component | null): boolean =>
  !!component?.is(ANIMATION_TYPE)

export const isAnimationGroup = (component?: Component | null): boolean =>
  !!component?.is(ANIMATION_GROUP_TYPE)

export const isGroupedAnimation = (component?: Component | null): boolean =>
  isAnimation(component) && isAnimationGroup(component?.parent())

// How many stagger steps this child sits behind the first. Browsers without
// `sibling-index()` (Safari 26.0/26.1) drop the declarations using it and play
// every child over the group's range together.
const STEP = "(sibling-index() - 1)"

const groupedRange = (edge: "start" | "end") =>
  `var(--tc-animation-range-${edge}-name) ` +
  `calc(var(--tc-animation-range-${edge}-offset) + ${STEP} * var(--tc-animation-stagger))`

const animationCss = `
@keyframes tc-fade-in {
  from { opacity: 0; }
}

.${GROUPED_CLASS} {
  animation-timeline: ${GROUP_TIMELINE};
  animation-range-start: ${groupedRange("start")};
  animation-range-end: ${groupedRange("end")};
}

@media (prefers-reduced-motion: reduce) {
  .${ANIMATION_CLASS} { animation: none !important; }
}
`

// A slide keyframe starts the element a full width to one side, and a
// transformed box still counts toward the page's scrollable overflow — so an
// Animation near the viewport edge would give the page a horizontal scrollbar
// until it reaches its range. The frame clips that. `clip`, not `hidden`:
// `hidden` makes the frame a scroll container, and a view timeline inside it
// would follow a box that never scrolls. Only the x axis, so vertical slides
// still travel over neighboring content.
const frameCss = `
.${FRAME_CLASS} {
  overflow-x: clip;
}
`

const groupCss = `
.${GROUP_CLASS} {
  view-timeline-name: ${GROUP_TIMELINE};
  --tc-animation-range-start-name: entry;
  --tc-animation-range-start-offset: 0%;
  --tc-animation-range-end-name: cover;
  --tc-animation-range-end-offset: 30%;
  --tc-animation-stagger: 10%;
}
`

/** Declarations a freshly dropped Animation starts with. */
export const ANIMATION_DEFAULT_STYLE: Record<string, string> = {
  "animation-name": "tc-fade-in",
  "animation-timing-function": "linear",
  "animation-fill-mode": "both",
  "animation-timeline": "view()",
  "animation-range-start": "entry 0%",
  "animation-range-end": "cover 30%",
}

const GROUPED_DEFAULT_STYLE: Record<string, string> = {
  "animation-name": "tc-fade-in",
  "animation-timing-function": "linear",
  "animation-fill-mode": "both",
}

const ANIMATION_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16.5 14a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13"/><path d="M17.14 15.98a8.5 8.5 0 0 1-9.12-9.12 6.5 6.5 0 1 0 9.12 9.12"/><path d="M12.64 20.48a8.5 8.5 0 0 1-9.12-9.12 6.5 6.5 0 1 0 9.12 9.12"/></svg>`

const GROUP_ICON = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M4 2a2 2 0 0 0-2 2v10h2V4h10V2H4m4 4a2 2 0 0 0-2 2v10h2V8h10V6H8m4 4a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-8Z"/></svg>`

const CATEGORY = "Animation"

type GroupModel = Component & {
  syncChild(child: Component, joined: boolean): void
}

export const animationPlugin: Plugin = (editor: Editor): void => {
  editor.Components.addType(ANIMATION_TYPE, {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList.contains(ANIMATION_CLASS),
    model: {
      defaults: {
        name: "Animation",
        tagName: "div",
        classes: [ANIMATION_CLASS],
        styles: animationCss,
      },
      init(this: Component) {
        // Parsed HTML replaces the default class list wholesale (GrapesJS
        // `initClasses`); the class is this type's identity, so re-assert it.
        this.addClass(ANIMATION_CLASS)
      },
    },
  })

  editor.Components.addType(ANIMATION_GROUP_TYPE, {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList.contains(GROUP_CLASS),
    model: {
      defaults: {
        name: "Animation Group",
        tagName: "div",
        classes: [GROUP_CLASS],
        droppable: `[data-gjs-type=${ANIMATION_TYPE}]`,
        styles: groupCss,
      },
      init(this: GroupModel) {
        this.addClass(GROUP_CLASS)
        const children = this.components()
        // Stored markup already carries the modifier; this covers children
        // parsed from HTML written before it existed.
        children.forEach((child: Component) => {
          if (isAnimation(child)) child.addClass(GROUPED_CLASS)
        })
        this.listenTo(children, "add", (child: Component) =>
          this.syncChild(child, true)
        )
        this.listenTo(children, "remove", (child: Component) =>
          this.syncChild(child, false)
        )
      },
      syncChild(this: GroupModel, child: Component, joined: boolean) {
        if (!isAnimation(child)) return
        if (!joined) {
          child.removeClass(GROUPED_CLASS)
          return
        }
        child.addClass(GROUPED_CLASS)
        GROUP_OWNED_PROPERTIES.forEach((prop) => child.removeStyle(prop))
      },
    },
  })

  // The clipping wrapper both blocks drop inside. A group is framed as a whole:
  // framing each grouped child would make every child the only one in its
  // frame, so `sibling-index()` would be 1 for all and the stagger would vanish.
  editor.Components.addType(ANIMATION_FRAME_TYPE, {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList.contains(FRAME_CLASS),
    model: {
      defaults: {
        name: "Animation Frame",
        tagName: "div",
        classes: [FRAME_CLASS],
        droppable: `[data-gjs-type=${ANIMATION_TYPE}], [data-gjs-type=${ANIMATION_GROUP_TYPE}]`,
        styles: frameCss,
      },
      init(this: Component) {
        this.addClass(FRAME_CLASS)
      },
    },
  })

  editor.Blocks.add(ANIMATION_TYPE, {
    label: "Animation",
    category: CATEGORY,
    media: ANIMATION_ICON,
    content: {
      type: ANIMATION_FRAME_TYPE,
      components: [
        {
          type: ANIMATION_TYPE,
          style: ANIMATION_DEFAULT_STYLE,
          components: [{ type: "text", content: "Animated content" }],
        },
      ],
    },
  })

  editor.Blocks.add(ANIMATION_GROUP_TYPE, {
    label: "Animation Group",
    category: CATEGORY,
    media: GROUP_ICON,
    content: {
      type: ANIMATION_FRAME_TYPE,
      components: [
        {
          type: ANIMATION_GROUP_TYPE,
          style: {
            display: "grid",
            "grid-template-columns": "repeat(3, minmax(0, 1fr))",
            gap: "var(--size-4)",
          },
          components: [1, 2, 3].map((n) => ({
            type: ANIMATION_TYPE,
            classes: [ANIMATION_CLASS, GROUPED_CLASS],
            style: GROUPED_DEFAULT_STYLE,
            components: [{ type: "text", content: `Animated item ${n}` }],
          })),
        },
      ],
    },
  })

  // The blocks' root is the frame, but the controls live on what it holds, so
  // select that on drop (in place of the block's own `select: true`).
  editor.on(
    "block:drag:stop",
    (
      dropped: Component | Component[] | undefined,
      block?: { getId(): string }
    ) => {
      const id = block?.getId()
      if (id !== ANIMATION_TYPE && id !== ANIMATION_GROUP_TYPE) return
      const frame = Array.isArray(dropped) ? dropped[0] : dropped
      const inner = frame?.is(ANIMATION_FRAME_TYPE)
        ? frame.components().at(0)
        : undefined
      if (inner) editor.select(inner)
    }
  )
}

export default animationPlugin
