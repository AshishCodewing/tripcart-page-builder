"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useEditor } from "@grapesjs/react"
import type { CssRule, Editor, StyleTarget } from "grapesjs"
import type { OnMount, BeforeMount } from "@monaco-editor/react"
import { useTheme } from "next-themes"

import { installMonacoEnvironment } from "./monaco-environment"
import {
  cleanStyle,
  diffStyle,
  formatRuleCss,
  parseRuleStyle,
  type ParsedRule,
} from "./rule-css"

// Monaco is large and browser-only: load the self-hosted `monaco-editor` build
// (no CDN) on first open, and point `@monaco-editor/react`'s loader at it
// before the editor mounts. Monaco 0.56 wires its workers with
// `new URL(..., import.meta.url)`, which the bundler picks up on its own.
const MonacoEditor = dynamic(
  async () => {
    const [{ default: Editor, loader }, monaco] = await Promise.all([
      import("@monaco-editor/react"),
      import("monaco-editor"),
    ])
    installMonacoEnvironment()
    loader.config({ monaco })
    return Editor
  },
  {
    ssr: false,
    loading: () => <EditorPlaceholder label="Loading editor…" />,
  }
)

const APPLY_DELAY_MS = 300
const MIN_HEIGHT = 160
const MAX_HEIGHT = 480

function isRule(target: StyleTarget): target is CssRule {
  return "selectorsToString" in target
}

/**
 * The CSS text for the Style Manager's current target. The target is whatever
 * the selection panel resolved — class rule, `#id` rule (component-first),
 * with the active state and device — so the selector line follows it.
 */
function readTargetCss(editor: Editor): string | null {
  const target = editor.StyleManager.getSelected()
  if (!target) return null
  const style = cleanStyle(target.getStyle() as Record<string, unknown>)
  if (isRule(target)) {
    return formatRuleCss({
      selector: target.selectorsToString(),
      atRule: target.getAtRule(),
      style,
    })
  }
  // Inline-style target (only without `avoidInlineStyle`): show it as its id.
  const cmp = editor.getSelected()
  const state = editor.Selectors.getState()
  const selector = `#${cmp?.getId() ?? "element"}${state ? `:${state}` : ""}`
  return formatRuleCss({ selector, style })
}

// `CssRuleJSON` is an `Omit<>` over an index-signature interface, which drops
// `style` from its type; the parsed objects do carry it.
function parseCss(editor: Editor, text: string) {
  return parseRuleStyle(
    text,
    (css) =>
      editor.Parser.parserCss.parse(css, { throwOnError: true }) as ParsedRule[]
  )
}

export default function CssCodeEditor() {
  const editor = useEditor()
  const { resolvedTheme } = useTheme()
  const [hasTarget, setHasTarget] = React.useState(
    () => editor.StyleManager.getSelected() != null
  )
  const [invalid, setInvalid] = React.useState(false)
  const [height, setHeight] = React.useState(MIN_HEIGHT)

  const instanceRef = React.useRef<Parameters<OnMount>[0] | null>(null)
  const focusedRef = React.useRef(false)
  const targetRef = React.useRef<StyleTarget | undefined>(
    editor.StyleManager.getSelected()
  )
  const pendingRef = React.useRef<string | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pull the target's CSS into the buffer. While the user is typing into the
  // same target, their buffer wins — rewriting it would jump the cursor and
  // reformat half-typed text; it is re-synced on blur.
  const refresh = React.useCallback(() => {
    const target = editor.StyleManager.getSelected()
    const sameTarget = target === targetRef.current
    targetRef.current = target
    if (sameTarget && focusedRef.current) return
    if (!sameTarget && timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
      pendingRef.current = null
    }
    setInvalid(false)
    const text = readTargetCss(editor)
    setHasTarget(text != null)
    // Imperative, not a `value` prop: the wrapper only diffs a changed prop,
    // so re-syncing to the same CSS after a blur would keep the typed buffer.
    const instance = instanceRef.current
    if (text != null && instance && instance.getValue() !== text) {
      instance.setValue(text)
    }
  }, [editor])

  const apply = React.useCallback(() => {
    timerRef.current = null
    const text = pendingRef.current
    pendingRef.current = null
    const target = editor.StyleManager.getSelected()
    if (text == null || !target || target !== targetRef.current) return
    const next = parseCss(editor, text)
    setInvalid(next == null)
    if (!next) return
    const prev = cleanStyle(target.getStyle() as Record<string, unknown>)
    const patch = diffStyle(prev, next)
    // `addStyleTargets` is what the Style Manager fields use: it writes every
    // selected target, keeps the state preview rule in sync and emits
    // `component:styleUpdate`. An empty value removes the property.
    if (Object.keys(patch).length > 0) {
      editor.StyleManager.addStyleTargets(patch, {})
    }
  }, [editor])

  React.useEffect(() => {
    let frame: number | null = null
    const schedule = () => {
      if (frame != null) return
      frame = requestAnimationFrame(() => {
        frame = null
        refresh()
      })
    }
    const events = [
      "style:target",
      "styleable:change",
      "component:styleUpdate",
      "selector:state",
      "device:select",
      // Undo/redo restore rule styles with a plain `set`, which skips
      // `styleable:change`.
      "undo",
      "redo",
    ]
    for (const ev of events) editor.on(ev, schedule)
    return () => {
      for (const ev of events) editor.off(ev, schedule)
      if (frame != null) cancelAnimationFrame(frame)
    }
  }, [editor, refresh])

  // Flush an in-flight edit rather than dropping it when the view closes.
  React.useEffect(
    () => () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        apply()
      }
    },
    [apply]
  )

  const handleChange = (text: string | undefined) => {
    if (text == null || !focusedRef.current) return
    pendingRef.current = text
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(apply, APPLY_DELAY_MS)
  }

  const handleBeforeMount: BeforeMount = (monaco) => {
    const colors = { "editor.background": "#00000000" }
    monaco.editor.defineTheme("tc-light", {
      base: "vs",
      inherit: true,
      rules: [],
      colors,
    })
    monaco.editor.defineTheme("tc-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors,
    })
  }

  const handleMount: OnMount = (instance) => {
    instanceRef.current = instance
    instance.onDidDispose(() => {
      if (instanceRef.current === instance) instanceRef.current = null
    })
    const fit = () =>
      setHeight(
        Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, instance.getContentHeight()))
      )
    fit()
    instance.onDidContentSizeChange(fit)
    instance.onDidFocusEditorText(() => {
      focusedRef.current = true
    })
    instance.onDidBlurEditorText(() => {
      focusedRef.current = false
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        apply()
      }
      refresh()
    })
  }

  if (!hasTarget) {
    return <EditorPlaceholder label="Select a component to edit its CSS." />
  }

  return (
    <div className="flex flex-col">
      <div style={{ height }}>
        <MonacoEditor
          language="css"
          defaultValue={readTargetCss(editor) ?? ""}
          theme={resolvedTheme === "dark" ? "tc-dark" : "tc-light"}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleChange}
          loading={<EditorPlaceholder label="Loading editor…" />}
          options={{
            fontSize: 12,
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 8,
            minimap: { enabled: false },
            overviewRulerLanes: 0,
            renderLineHighlight: "none",
            scrollBeyondLastLine: false,
            scrollbar: { alwaysConsumeMouseWheel: false },
            wordWrap: "on",
            tabSize: 2,
            automaticLayout: true,
            // The sidebar clips overflow; let suggest/hover widgets escape it.
            fixedOverflowWidgets: true,
          }}
        />
      </div>
      {invalid && (
        <p role="status" className="px-3 py-2 text-xs text-destructive">
          Invalid CSS — fix it to apply your changes.
        </p>
      )}
    </div>
  )
}

function EditorPlaceholder({ label }: { label: string }) {
  return <p className="px-3 py-4 text-xs text-muted-foreground">{label}</p>
}
