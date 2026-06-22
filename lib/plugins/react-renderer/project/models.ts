// Lightweight, read-only mirrors of GrapesJS's runtime models, hydrated from
// the `editor.getProjectData()` JSON snapshot. The project renderer can be
// used outside the editor (e.g. in a Next.js publish route) where pulling in
// the full editor is unwanted, so we walk the JSON directly.

import type {
  ComponentDefinition,
  DataSource,
  DocElDefinition,
  FrameDefinition,
  PageDefinition,
} from "./types"
import { normalizeClasses, resolveTagName } from "./component-mapper"

export class ComponentNode {
  private data: ComponentDefinition

  constructor(data: ComponentDefinition) {
    this.data = data
  }

  get id(): string | undefined {
    return this.data.attributes?.id
  }

  get type(): string {
    return this.data.type || "default"
  }

  // Map GrapesJS component types to their canonical HTML tag (see
  // ./component-mapper).
  get tagName(): string {
    return resolveTagName(this.type, this.data.tagName)
  }

  get isVoid(): boolean {
    if (this.tagName === "img") return true
    return !!this.data.void
  }

  get attributes(): Record<string, unknown> {
    const out: Record<string, unknown> = { ...this.data.attributes }
    const { classes } = this
    if (classes.length) out.class = classes.join(" ")
    if (!Object.prototype.hasOwnProperty.call(out, "id")) {
      out.id = this.id
    }
    return out
  }

  get content(): string {
    return this.data.content || ""
  }

  get components(): ComponentNode[] {
    return (this.data.components || []).map((c) => new ComponentNode(c))
  }

  // GrapesJS persists a `head` component; if missing, we fall back to a bare
  // `<head>` so RenderPage can still produce valid markup.
  get head(): ComponentNode {
    return new ComponentNode(this.data.head || { tagName: "head" })
  }

  get docEl(): DocElDefinition | undefined {
    return this.data.docEl
  }

  // `data.classes` may carry plain strings or `{ name, ... }` objects.
  get classes(): string[] {
    return normalizeClasses(this.data.classes)
  }
}

export class Frame {
  private data: FrameDefinition

  constructor(data: FrameDefinition) {
    this.data = data
  }

  get component(): ComponentNode | null {
    return this.data.component ? new ComponentNode(this.data.component) : null
  }
}

export class Page {
  private data: PageDefinition

  constructor(data: PageDefinition) {
    this.data = data
  }

  get id(): string | undefined {
    return this.data.id
  }

  get frames(): Frame[] {
    return (this.data.frames || []).map((f) => new Frame(f))
  }
}

export class Pages {
  private pages: Page[]

  constructor(pages: PageDefinition[]) {
    this.pages = pages.map((p) => new Page(p))
  }

  getAll(): Page[] {
    return this.pages
  }
}

export class DataSourceManager {
  private list: DataSource[]

  constructor(list: DataSource[]) {
    this.list = list
  }

  getAll(): DataSource[] {
    return this.list
  }
}

export const findComponentById = (
  root: ComponentNode,
  id: string
): ComponentNode | null => {
  if (root.id === id) return root
  for (const child of root.components) {
    const found = findComponentById(child, id)
    if (found) return found
  }
  return null
}
