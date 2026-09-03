"use client"

import * as React from "react"
import GjsEditor, { Canvas } from "@grapesjs/react"
import {
  grapesjs,
  type Component,
  type Editor,
  type EditorConfig,
} from "grapesjs"
import parserPostCSS from "grapesjs-parser-postcss"
import styleBgPlugin from "grapesjs-style-bg"
import styleFilterPlugin from "grapesjs-style-filter"

import "grapesjs/dist/css/grapes.min.css"

import { THEME_STYLE_SECTORS } from "@/components/page-builder/editor-config/theme-style-sectors"
import { applyThemeTokenOptions } from "@/components/page-builder/editor-config/theme-token-options"
import { useIsClient } from "@/hooks/use-is-client"
import { buttonPlugin } from "@/lib/plugins/button"
import { designSystemPlugin } from "@/lib/plugins/design-system-plugin"
import { tabsPlugin } from "@/lib/plugins/interactive"
import { CONTENT_STYLE_URLS } from "@/lib/theme/content-style-urls"
import {
  SELECTED_ATTR,
  SPECIMEN_ATTR,
  styleBookHtml,
} from "@/lib/theme/style-book"
import { themeStore } from "@/lib/theme/theme-store"

// Specimen chrome. The accent matches the page editor's selection outline
// (canvas-chrome-css.ts), hardcoded for the same reason: the canvas is a
// separate document that never loads the app's Tailwind theme.
const BOOK_CHROME_CSS = `
body { padding: var(--size-5, 1.5rem); }
[${SPECIMEN_ATTR}] {
  display: block;
  padding: var(--size-3, 1rem);
  border-radius: var(--radius-2, 6px);
  cursor: pointer;
}
[${SPECIMEN_ATTR}] + [${SPECIMEN_ATTR}] { margin-top: var(--size-4, 1.25rem); }
[${SPECIMEN_ATTR}][${SELECTED_ATTR}] {
  outline: 2px solid oklch(0.631 0.2 257.6);
  outline-offset: -2px;
}
.tc-book-label {
  font: 500 0.6875rem/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.55;
  margin-bottom: var(--size-2, 0.5rem);
}
`

const lockSelection = (component: Component): void => {
  component.set({ selectable: false, hoverable: false, highlightable: false })
  component.components().forEach(lockSelection)
}

type Props = {
  onEditor: (editor: Editor) => void
  children: React.ReactNode
}

/**
 * The style book: a second GrapesJS instance whose canvas holds specimens of
 * every themeable block, and whose Style Manager edits the tenant's theme.
 *
 * A real editor buys two things. The canvas loads the same stylesheets,
 * structural block CSS and `designSystemPlugin` the page editor does, so a
 * specimen renders exactly as a dropped block; and the Style Manager's whole
 * control set works on theme rules once it is pointed at a selector, so no
 * block needs bespoke UI.
 *
 * Specimens are locked out of selection on purpose: `StyleManager.upAll`
 * re-selects from the component selection on several editor events, and with no
 * component selected that blanks a selector target. Selection here is a theme
 * concept, driven by the left panel.
 */
export default function StyleBookEditor({ onEditor, children }: Props) {
  const isClient = useIsClient()

  const options = React.useMemo<EditorConfig>(
    () => ({
      height: "100%",
      showToolbar: false,
      canvasCss: BOOK_CHROME_CSS,
      // No drafts and no `tc-remote`: the theme is the only thing this screen
      // persists, through the theme editor's own Save.
      storageManager: false,
      panels: { defaults: [] },
      layerManager: { custom: true },
      styleManager: { sectors: THEME_STYLE_SECTORS },
      canvas: { styles: [...CONTENT_STYLE_URLS] },
      // The two style plugins are what make `background` and `filter`
      // resolve to the same controls the page editor shows.
      plugins: [
        parserPostCSS,
        designSystemPlugin,
        buttonPlugin,
        tabsPlugin,
        styleFilterPlugin,
        styleBgPlugin,
      ],
    }),
    []
  )

  const handleEditor = React.useCallback(
    (editor: Editor) => {
      // Deliberately no `window.editor` and no save-status wiring here: both
      // are owned by the page editor and a second writer would corrupt them.
      editor.on("load", () => {
        const wrapper = editor.getWrapper()
        if (!wrapper || wrapper.components().length > 0) return
        wrapper.append(styleBookHtml())
        wrapper.set({ selectable: false, hoverable: false })
        wrapper.components().forEach(lockSelection)
      })

      // Same label overrides as the page editor: the background plugin
      // registers its sub-properties under their full CSS names, which
      // humanise to "Background Repeat" and so on.
      editor.I18n.addMessages({
        en: {
          styleManager: {
            properties: {
              "background-repeat": "Repeat",
              "background-position": "Position",
              "background-attachment": "Attachment",
              "background-size": "Size",
            },
          },
        },
      })

      // The tenant's font tokens sit at the top of the font dropdowns, and
      // follow the theme: renaming or adding one re-fills the lists.
      const syncTokens = (): void =>
        applyThemeTokenOptions(editor, themeStore.getTheme())
      editor.on("load", syncTokens)
      const unsubscribe = themeStore.subscribe(syncTokens)
      editor.on("destroy", unsubscribe)

      onEditor(editor)
    },
    [onEditor]
  )

  // GrapesJS needs a window and a canvas iframe.
  if (!isClient) return null

  return (
    <GjsEditor grapesjs={grapesjs} options={options} onEditor={handleEditor}>
      <div className="grid h-full gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 overflow-y-auto">{children}</div>
        <div className="min-h-96 overflow-hidden rounded-lg border bg-card">
          <Canvas className="size-full" />
        </div>
      </div>
    </GjsEditor>
  )
}
