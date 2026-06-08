// Bind a GrapesJS Component to the actual DOM element React produced for it.
// The default ComponentView creates and owns its own DOM; here we extend the
// matching view class so it adopts the React-rendered element instead, then
// only re-runs attribute application + data hooks on render.

import type { Component, ComponentView, Editor } from "grapesjs"
import type { CustomRendererPropsWithConfig } from "./types"

interface BindArgs {
  editor: Editor
  component: Component
  el: HTMLElement
  frameView: CustomRendererPropsWithConfig["frameView"]
}

export const bindComponentToElement = (args: BindArgs): ComponentView => {
  const { editor, component, el, frameView } = args
  const { em, Components } = editor

  // Existing view already pointed at this DOM node? Done.
  let view = component.getView(frameView.model)
  if (view?.el === el) return view

  if (!view) {
    const FallbackView = (Components as unknown as { ComponentView: unknown })
      .ComponentView as {
      extend: (
        overrides: object
      ) => new (opts: {
        el: HTMLElement
        config: object
        model: Component
      }) => ComponentView
    }

    const typeName =
      (component.attributes as { type?: string }).type || "default"
    const typeEntry = Components.getType(typeName) as
      | { view?: typeof FallbackView }
      | undefined
    const ViewClass = typeEntry?.view ?? FallbackView

    const viewConfig = {
      ...(Components as unknown as { config: object }).config,
      frameView,
      em,
    }

    // The Backbone-style overrides keep the view from creating, replacing, or
    // clearing the element it didn't author. `render` reduces to the bits
    // GrapesJS still needs to touch (data wiring, attributes, src updates).
    const ExtendedView = ViewClass.extend({
      initComponents() {
        /* no-op: children are owned by React */
      },
      _createElement() {
        return el
      },
      _removeElement() {
        /* no-op */
      },
      __clearAttributes() {
        /* no-op */
      },
      render() {
        const self = this as ComponentView & {
          _ensureElement: () => void
          _setData: () => void
          renderAttributes: () => void
          updateSrc?: () => void
        }
        self._ensureElement()
        self._setData()
        self.renderAttributes()
        self.updateSrc?.()
        return self
      },
    })

    view = new ExtendedView({ el, config: viewConfig, model: component })
  }

  view.el = el
  view.render()
  return view
}
