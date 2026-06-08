// Read-only mirrors of GrapesJS's runtime models, hydrated from the
// `editor.getProjectData()` JSON snapshot, so the project renderer can run
// outside the editor (e.g. in a Next.js publish route).
//
// The implementation is split across focused modules; this barrel preserves
// the original public surface:
//   - `models`         — ComponentNode, Frame, Page(s), DataSourceManager,
//                         findComponentById
//   - `css-composer`   — CssComposer (snapshot `styles` -> CSS string)
//   - `project-editor` — ProjectEditor façade composing the above

export {
  ComponentNode,
  DataSourceManager,
  Frame,
  Page,
  Pages,
  findComponentById,
} from "./models"
export { CssComposer } from "./css-composer"
export { ProjectEditor } from "./project-editor"
