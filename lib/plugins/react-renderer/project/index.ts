// Project renderer — render a saved GrapesJS project (the JSON returned by
// `editor.getProjectData()`) as a React tree, outside the editor. Suitable
// for SSR (Next.js route handlers, RSC, etc.) and for static-HTML emission.
//
// Usage:
//   import { RenderProject } from "@/lib/plugins/react-renderer/project"
//   <RenderProject projectData={data} pageId="home" config={{ components }} />

export { RenderProject, default } from "./render-project"
export { RenderPage } from "./render-page"
export { RenderComponent } from "./render-component"
export { RenderError } from "./render-error"
export {
  ComponentNode,
  Frame,
  Page,
  Pages,
  CssComposer,
  DataSourceManager,
  ProjectEditor,
  findComponentById,
} from "./parser"
export type {
  Asset,
  Rule,
  DataSource,
  DocElDefinition,
  ComponentDefinition,
  FrameDefinition,
  PageDefinition,
  ProjectDefinition,
  RenderCommonProps,
  RenderProjectProps,
  RenderPageProps,
  RenderComponentProps,
} from "./types"
