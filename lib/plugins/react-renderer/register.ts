// Register a custom component type for every entry in `config.components`.
// Also patches each Component model's toJSON so the resolved tagName lands in
// serialized output — without this, custom React-typed components round-trip
// without their tag.

import type { Editor } from "grapesjs"
import type { RendererReactOptions } from "./types"

// We patch toJSON on every component class. The grapesjs typings for the type
// registry are loose, so we accept the lookup as `any` and narrow internally.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponentClass = { prototype: { toJSON: (...args: any[]) => any } }

const patchToJSONForType = (
  editor: Editor,
  args: { id: string; model?: AnyComponentClass | unknown }
): void => {
  const { id, model } = args
  if (!model) return
  const cmpClass = model as AnyComponentClass
  editor.Components.addType(id, {
    model: {
      toJSON(...rest: unknown[]) {
        // Call the original toJSON, then layer in the runtime tagName so the
        // serialized component carries it (the parent class's toJSON often
        // omits tagName for typed components).
        const json = cmpClass.prototype.toJSON.apply(this, rest as [])
        json.tagName = (this as { tagName: string }).tagName
        return json
      },
    },
  })
}

export const registerComponents = (
  editor: Editor,
  config: RendererReactOptions
): void => {
  const { Components } = editor

  // Patch every existing type, and every type added later.
  Components.getTypes().forEach((entry) => {
    patchToJSONForType(editor, entry as { id: string; model?: unknown })
  })
  editor.on("component:type:add", (entry) => {
    patchToJSONForType(editor, entry as { id: string; model?: unknown })
  })

  Object.entries(config.components || {}).forEach(([typeName, cfg]) => {
    const { allowPropClassName, allowPropId, allowChildren } = cfg
    // If neither id nor className is allowed, the component is fully opaque
    // to the style manager / selector manager.
    const disabled = !allowPropId && !allowPropClassName
    const styleManager = () => ({ disabled })
    const selectorManager = () => ({
      disableClasses: !allowPropClassName,
      disableComponent: !allowPropId,
    })

    Components.addType(typeName, {
      isComponent: (el: HTMLElement) => el?.tagName === typeName,
      model: {
        defaults: {
          type: typeName,
          traits: cfg.props?.() ?? [],
          droppable: !!allowChildren,
          stylable: !disabled,
          styleManager,
          selectorManager,
          ...(cfg.model?.defaults ?? {}),
        },
      },
    })
  })
}
