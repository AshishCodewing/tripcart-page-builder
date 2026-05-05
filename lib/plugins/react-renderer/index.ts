// React renderer plugin for GrapesJS — homegrown port of the
// `@grapesjs/studio-sdk-plugins/rendererReact` plugin without the Studio
// licensing/event-bus bits. Public API mirrors the SDK so component configs
// are portable.
//
// Usage:
//   plugins: [
//     reactRendererPlugin.init({
//       components: {
//         MyHero: { component: MyHero, allowChildren: true, props: () => [...] },
//       },
//     }),
//   ]

import type { Editor } from "grapesjs"
import { renderRoot } from "./render-root"
import {
  processReactElements,
  manageReactBlockContent,
  manageReactPageContent,
} from "./process"
import { registerComponents } from "./register"
import type { RendererReactOptions } from "./types"

export type {
  ComponentConfig,
  EditorRenderProps,
  EditorProps,
  RendererReactOptions,
  RenderErrorProps,
  RootComponentProps,
  WithEditorProps,
} from "./types"
export { ErrorType } from "./types"

type Plugin = (editor: Editor, options?: RendererReactOptions) => void
type PluginWithInit = Plugin & {
  init: (options: RendererReactOptions) => (editor: Editor) => void
}

const installRenderer: Plugin = (editor, options = {}) => {
  const config = options
  const Blocks = editor.Blocks
  const Pages = editor.Pages

  const blockEvents = Blocks.events
  const pageEvents = Pages.events

  // Canvas hands every frame render through this when configured. We mount a
  // React root onto the iframe body and walk the GrapesJS component tree
  // from there.
  editor.Canvas.config.customRenderer = (props) =>
    renderRoot({ ...props, config })

  // Component definitions can be JSX. The processor runs whenever a model is
  // added; if it's a React element, we transform it into a regular GrapesJS
  // component definition.
  ;(
    editor.Components.config as { processor?: (model: unknown) => unknown }
  ).processor = (model) => processReactElements({ model, editor, config })

  registerComponents(editor, config)

  const onBlockAdd = manageReactBlockContent({ editor, config })
  const onPageAddBefore = manageReactPageContent({ editor, config })

  editor.on(blockEvents.add, onBlockAdd)
  editor.on(pageEvents.addBefore, onPageAddBefore)

  editor.on("destroy", () => {
    editor.off(blockEvents.add, onBlockAdd)
    editor.off(pageEvents.addBefore, onPageAddBefore)
    editor.Canvas.config.customRenderer = undefined
    ;(
      editor.Components.config as { processor?: (model: unknown) => unknown }
    ).processor = undefined
  })
}

const reactRendererPlugin: PluginWithInit = Object.assign(installRenderer, {
  init: (options: RendererReactOptions) => (editor: Editor) =>
    installRenderer(editor, options),
})

export default reactRendererPlugin
