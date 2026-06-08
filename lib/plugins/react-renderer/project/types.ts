// Shapes for the JSON GrapesJS produces from `editor.getProjectData()`.
// These are deliberately loose (matching the SDK) — the live editor types
// in `grapesjs` are stricter than what survives serialization, and the
// project renderer needs to be tolerant of partial / older snapshots.

import type { ReactNode } from "react"
import type { CssRuleProperties } from "grapesjs"
import type { RendererReactOptions } from "../types"
import type { ComponentNode } from "./parser"

export interface Asset {
  type?: string
  src?: string
  unitDim?: string
  height?: number
  width?: number
}

export interface Rule extends Omit<CssRuleProperties, "selectors"> {
  selectors?: string[]
}

export interface DataSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface DocElDefinition {
  tagName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface ComponentDefinition {
  id?: string
  type?: string
  tagName?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes?: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  style?: Record<string, any>
  content?: string
  components?: ComponentDefinition[]
  head?: ComponentDefinition
  docEl?: DocElDefinition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classes?: Array<string | { name: string; [key: string]: any }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface FrameDefinition {
  component?: ComponentDefinition
  width?: string
  height?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface PageDefinition {
  id?: string
  name?: string
  frames?: FrameDefinition[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface ProjectDefinition {
  assets?: Asset[]
  styles?: Rule[]
  pages?: PageDefinition[]
  dataSources?: DataSource[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface RenderCommonProps {
  config?: RendererReactOptions
}

export interface RenderProjectProps extends RenderCommonProps {
  projectData: ProjectDefinition
  pageId?: string
  componentId?: string
}

export interface RenderPageProps extends RenderCommonProps {
  root: ComponentNode
  css: string
}

export interface RenderComponentProps extends RenderCommonProps {
  component: ComponentNode | null
  children?: ReactNode
  parentId?: string
  index?: number
}
