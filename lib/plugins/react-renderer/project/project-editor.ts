// Façade that mimics the live `editor` surface for the bits the project
// renderer needs: Pages, Css, DataSources.

import type { ProjectDefinition } from "./types"
import { CssComposer } from "./css-composer"
import { DataSourceManager, Pages } from "./models"

export class ProjectEditor {
  Css: CssComposer
  Pages: Pages
  DataSources: DataSourceManager

  constructor(data: ProjectDefinition) {
    this.Css = new CssComposer(data.styles || [])
    this.Pages = new Pages(data.pages || [])
    this.DataSources = new DataSourceManager(data.dataSources || [])
  }
}
