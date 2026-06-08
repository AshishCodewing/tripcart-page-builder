// Helpers for inspecting React elements at runtime — the renderer accepts
// JSX as block content and as model.processor input, so we need to detect
// it and look up the registered config entry by component identity.

import type { ComponentType, ReactElement } from "react"
import type { ComponentConfig, RendererReactOptions } from "./types"

// React's runtime tag — present on any element returned by `createElement` or
// JSX. We treat anything carrying $$typeof + a props object as an element.
export const isReactElement = (value: unknown): value is ReactElement => {
  if (!value || typeof value !== "object") return false
  const v = value as { $$typeof?: unknown; props?: unknown }
  return !!v.$$typeof && typeof v.props === "object"
}

export const getComponentConfig = (
  config: RendererReactOptions,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reactComponent: ComponentType<any>
): { cmpConfig: ComponentConfig; type: string } | undefined => {
  const components = config.components || {}
  for (const type in components) {
    const cmpConfig = components[type]
    if (cmpConfig.component === reactComponent) {
      return { cmpConfig, type }
    }
  }
  return undefined
}
