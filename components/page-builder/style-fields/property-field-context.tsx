"use client"

import * as React from "react"
import type { Property } from "grapesjs"

export type RenderProperty = (property: Property) => React.ReactNode

const PropertyFieldContext = React.createContext<RenderProperty | null>(null)

export function usePropertyRenderer(): RenderProperty {
  const fn = React.useContext(PropertyFieldContext)
  if (!fn) {
    throw new Error(
      "usePropertyRenderer must be used within PropertyFieldProvider"
    )
  }
  return fn
}

export const PropertyFieldProvider = PropertyFieldContext.Provider
