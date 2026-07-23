// Rich-text editing: GrapesJS' built-in execCommand engine, our own toolbar.
//
// The UI half lives in `components/page-builder/rte-toolbar.tsx`. It's wired up
// by `richTextEditor: { custom: true }` in the editor config, which tells
// GrapesJS to skip its default action bar while still creating, positioning and
// showing/hiding the toolbar container over the element being edited.

import type { Editor, Plugin } from "grapesjs"

import { registerRteActions } from "./actions"

export const rtePlugin: Plugin = (editor: Editor) => {
  registerRteActions(editor)
}

export {
  PORTED_ACTIONS,
  RTE_ACTIONS,
  RTE_STATE,
  registerRteActions,
} from "./actions"
export {
  BLOCK_FORMATS,
  applyBlockFormat,
  applyInlineStyle,
  captureRange,
  currentRange,
  exactWrappingSpan,
  findAnchor,
  normalizeBlockFormat,
  readBlockFormat,
  restoreRange,
  unlinkAt,
  wrapSelection,
  wrapSelectionEl,
  type Rte,
} from "./selection"

export default rtePlugin
