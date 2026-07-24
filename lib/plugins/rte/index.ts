// Rich-text editing: ProseMirror as the engine, our own shadcn toolbar as the UI.
//
// The engine is swapped into GrapesJS via `editor.setCustomRte(...)` (see
// prosemirror-rte.ts). The toolbar lives in
// `components/page-builder/rte-toolbar.tsx`; it grabs the live `EditorView` from
// the `tc-rte:*` editor events this plugin emits and drives it through the pure
// command layer in `commands.ts`.

import { rtePlugin } from "./prosemirror-rte"

export { rtePlugin, RTE_EVENTS } from "./prosemirror-rte"

export {
  BLOCK_FORMATS,
  ALIGNMENTS,
  TEXT_STYLE_PROPS,
  schema,
  blockSchema,
  inlineSchema,
  isInlineHost,
  schemaFor,
  parseElement,
  serializeDoc,
  type TextStyleAttr,
} from "./schema"

export {
  MARK_COMMANDS,
  runCmd,
  toggleInlineMark,
  markActive,
  setBlockFormat,
  blockFormat,
  listActive,
  toggleList,
  indent,
  setAlign,
  alignActive,
  linkAt,
  applyLink,
  removeLink,
  applyTextStyle,
  insertHorizontalRule,
  insertHardBreak,
  removeFormat,
  undoCmd,
  redoCmd,
  type LinkAttrs,
} from "./commands"

export default rtePlugin
