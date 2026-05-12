// Columns plugin — re-implements the GrapesJS Studio SDK's column blocks on
// top of OSS GrapesJS. Provides:
//
//   • `gridRow`    — flex container that only accepts `gridColumn` children
//   • `gridColumn` — flex item that may only live inside a `gridRow`
//   • `column1`, `column2`, `column3`, `column3-7` blocks
//   • `Add column` button trait on rows  (runs the `columns:add-column` cmd)
//   • `Center content` checkbox trait on columns
//   • Vertical resize handle on rows wired to `min-height`
//   • Default stylesheet for `.gjs-grid-row` and `.gjs-grid-column`
//
// Behavior matches `node_modules/@grapesjs/studio-sdk/dist/index.es.js` (see
// the column-block-and-style-manager.md study) so the Style Manager flex-
// container / flex-child gating in `style-fields/visibility.ts`
// surfaces the right controls automatically.

import type { Component, Editor } from "grapesjs"

const ROW_CLASS = "gjs-grid-row"
const COLUMN_CLASS = "gjs-grid-column"
const ADD_COLUMN_CMD = "columns:add-column"

const ROW_CSS = `
.${ROW_CLASS} {
  padding: 10px;
  display: flex;
  flex-direction: row;
}
.${COLUMN_CLASS} {
  min-width: 30px;
  padding: 10px;
  display: block;
  width: 100%;
}
`

// Backbone-style change handler signature — `this` is the Component model.
type CenterContentModel = Component & {
  get(key: "center-content"): boolean | undefined
  addStyle(style: Record<string, string>): void
  removeStyle(props: string[]): void
  handleCenter(): void
}

export const columnsPlugin = (editor: Editor): void => {
  // 1. Default stylesheet — added once, lives in the iframe alongside any
  //    user-authored CSS. Mirrors `ROW_CSS` above so the canvas defaults match
  //    the inline styles embedded in dropped blocks.
  const css = editor.Css
  css.setRule(`.${ROW_CLASS}`, {
    padding: "10px",
    display: "flex",
    "flex-direction": "row",
  })
  css.setRule(`.${COLUMN_CLASS}`, {
    "min-width": "30px",
    padding: "10px",
    display: "block",
    width: "100%"
  })

  // 2. `gridRow` — flex container, only accepts gridColumn children, vertical
  //    resize writes `min-height` (so columns can still grow), houses the
  //    Add-column button trait.
  editor.Components.addType("gridRow", {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList.contains(ROW_CLASS)
        ? { type: "gridRow" }
        : undefined,
    model: {
      defaults: {
        name: "Row",
        tagName: "div",
        classes: [ROW_CLASS],
        droppable: `[data-gjs-type=gridColumn]`,
        resizable: {
          tl: 0,
          tc: 0,
          tr: 0,
          cl: 0,
          cr: 0,
          bl: 0,
          bc: 1,
          br: 0,
          keyHeight: "min-height",
          currentUnit: 1,
          minDim: 30,
        },
        traits: [
          {
            type: "button",
            name: "add-column",
            label: "Add Column",
            text: "+ Add column",
            full: true,
            command: ADD_COLUMN_CMD,
          },
        ],
      },
    },
  })

  // 3. `gridColumn` — flex item, may only be dragged onto a gridRow, exposes
  //    the Center-content checkbox trait.
  editor.Components.addType("gridColumn", {
    isComponent: (el) =>
      el instanceof HTMLElement && el.classList.contains(COLUMN_CLASS)
        ? { type: "gridColumn" }
        : undefined,
    model: {
      defaults: {
        name: "Column",
        tagName: "div",
        classes: [COLUMN_CLASS],
        draggable: `[data-gjs-type=gridRow]`,
        // Default value of the prop the Center-content trait binds to. Stored
        // on the component so it round-trips through save/load.
        "center-content": false,
        traits: [
          {
            type: "checkbox",
            name: "center-content",
            label: "Center content",
            changeProp: true,
          },
        ],
      },
      init(this: CenterContentModel) {
        this.on("change:center-content", this.handleCenter)
      },
      handleCenter(this: CenterContentModel) {
        if (this.get("center-content")) {
          this.addStyle({
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
          })
        } else {
          this.removeStyle(["display", "align-items", "justify-content"])
        }
      },
    },
  })

  // 4. Add-column command — appends a fresh gridColumn to the selected row.
  //    Triggered by the Add-column button trait above; also callable via
  //    `editor.runCommand('columns:add-column')` from anywhere.
  editor.Commands.add(ADD_COLUMN_CMD, {
    run(ed) {
      const sel = ed.getSelected()
      if (!sel || !sel.is("gridRow")) return
      sel.components().add({ type: "gridColumn" })
    },
  })

  // 5. Embed the default stylesheet inline in the block content too — this
  //    makes the blocks self-sufficient when copied between projects, and
  //    re-asserts the styles if the CssComposer is cleared.
  const styleTag = `<style>${ROW_CSS}</style>`

  const rowAttrs = `class="${ROW_CLASS}"`
  const columnAttrs = `class="${COLUMN_CLASS}"`

  const blocks = editor.Blocks
  const common = { category: "Basic", select: true }

  blocks.add("column1", {
    ...common,
    label: "1 Column",
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 20h20V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h20a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1Z"/></svg>',
    content: `<div ${rowAttrs}><div ${columnAttrs}></div></div>${styleTag}`,
  })

  blocks.add("column2", {
    ...common,
    label: "2 Columns",
    media:
      '<svg viewBox="0 0 23 24"><path fill="currentColor" d="M2 20h8V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM13 20h8V4h-8v16Zm-1 0V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1Z"/></svg>',
    content: `<div ${rowAttrs}><div ${columnAttrs}></div><div ${columnAttrs}></div></div>${styleTag}`,
  })

  blocks.add("column3", {
    ...common,
    label: "3 Columns",
    media:
      '<svg viewBox="0 0 23 24"><path fill="currentColor" d="M2 20h4V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM17 20h4V4h-4v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1ZM9.5 20h4V4h-4v16Zm-1 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"/></svg>',
    content: `<div ${rowAttrs}><div ${columnAttrs}></div><div ${columnAttrs}></div><div ${columnAttrs}></div></div>${styleTag}`,
  })

  // 30 / 70 preset — the first cell gets `flex-basis: 30%` and `flex-grow: 0`
  // so it keeps its size; the second column expands to fill the rest. This is
  // the canonical pattern for any custom uneven column block.
  blocks.add("column3-7", {
    ...common,
    label: "2 Columns 3/7",
    media:
      '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M2 20h5V4H2v16Zm-1 0V4a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1ZM10 20h12V4H10v16Zm-1 0V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1Z"/></svg>',
    content: `<div ${rowAttrs}><div ${columnAttrs} style="flex-basis: 30%; flex-grow: 0;"></div><div ${columnAttrs}></div></div>${styleTag}`,
  })
}
