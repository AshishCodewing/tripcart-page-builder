"use client"

import * as React from "react"
import { useEditorMaybe } from "@grapesjs/react"
import type { Component } from "grapesjs"
import type { EditorView } from "prosemirror-view"
import {
  Baseline,
  Bold,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from "lucide-react"

import {
  MARK_COMMANDS,
  indent,
  listActive,
  markActive,
  RTE_EVENTS,
  runCmd,
  toggleInlineMark,
  toggleList,
} from "@/lib/plugins/rte"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { CanvasFloating } from "./canvas-floating"
import {
  AlignSelect,
  BlockFormatSelect,
  ColorControl,
  FontSizeSelect,
  ImageControl,
  LinkControl,
} from "./rte-toolbar-fields"

// GrapesJS stops `mousedown` bubbling out of its own toolbar; ours lives
// elsewhere, so the root <div> re-adds `stopPropagation` (keeps the edit
// session alive) and each control captures `mousedown` to `preventDefault` —
// DOM focus stays off the button while the ProseMirror selection (in
// view.state) is preserved; `runCmd` re-focuses the view before dispatching.
const keepFocus = (e: React.MouseEvent) => e.preventDefault()

type MarkDef = { name: keyof typeof MARK_COMMANDS; title: string; icon: React.ReactNode }

const MARKS: MarkDef[] = [
  { name: "bold", title: "Bold", icon: <Bold /> },
  { name: "italic", title: "Italic", icon: <Italic /> },
  { name: "underline", title: "Underline", icon: <Underline /> },
  { name: "strikethrough", title: "Strikethrough", icon: <Strikethrough /> },
]

/** Inline marks — independent toggles, so a multi-select ToggleGroup. */
function MarkToggles({ view }: { view: EditorView }) {
  const state = view.state
  const active = MARKS.filter((m) =>
    markActive(state, MARK_COMMANDS[m.name])
  ).map((m) => m.name)

  return (
    <ToggleGroup
      variant="outline"
      multiple
      value={active}
      onValueChange={(next: string[]) => {
        // Exactly one item flips per click — toggle that mark.
        const before = new Set(active)
        const after = new Set(next)
        const changed = MARKS.find((m) => before.has(m.name) !== after.has(m.name))
        if (changed) runCmd(view, toggleInlineMark(MARK_COMMANDS[changed.name]))
      }}
    >
      {MARKS.map((m) => (
        <Tooltip key={m.name}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={m.name}
                aria-label={m.title}
                onMouseDownCapture={keepFocus}
              >
                {m.icon}
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{m.title}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}

const LIST_ITEMS = [
  { value: "bullet", title: "Bulleted list", icon: <List /> },
  { value: "ordered", title: "Numbered list", icon: <ListOrdered /> },
] as const

/**
 * Bulleted vs numbered are mutually exclusive (a block is one, the other, or
 * neither), so a single-select ToggleGroup — picking one switches, re-picking
 * the active one clears back to a plain block.
 */
function ListToggles({ view }: { view: EditorView }) {
  const state = view.state
  const current = listActive(state, false)
    ? "bullet"
    : listActive(state, true)
      ? "ordered"
      : ""

  return (
    <ToggleGroup
      variant="outline"
      value={current ? [current] : []}
      onValueChange={(next: string[]) => {
        const nextVal = next[0] ?? ""
        if (nextVal === current) return
        if (nextVal === "bullet") runCmd(view, toggleList(false))
        else if (nextVal === "ordered") runCmd(view, toggleList(true))
        // Deselected the active list → lift it back to a plain block.
        else runCmd(view, toggleList(current === "ordered"))
      }}
    >
      {LIST_ITEMS.map((it) => (
        <Tooltip key={it.value}>
          <TooltipTrigger
            render={
              <ToggleGroupItem
                value={it.value}
                aria-label={it.title}
                onMouseDownCapture={keepFocus}
              >
                {it.icon}
              </ToggleGroupItem>
            }
          />
          <TooltipContent>{it.title}</TooltipContent>
        </Tooltip>
      ))}
    </ToggleGroup>
  )
}

/** A momentary action (indent/outdent) — a plain button, not a toggle. */
function ActionButton({
  view,
  label,
  onRun,
  children,
}: {
  view: EditorView
  label: string
  onRun: (view: EditorView) => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onMouseDownCapture={keepFocus}
            onClick={() => onRun(view)}
          >
            {children}
          </Button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

const Divider = () => (
  <Separator orientation="vertical" className="mx-0.5 h-5 self-center!" />
)

/**
 * The rich-text toolbar.
 *
 * The RTE engine is ProseMirror (swapped in via `editor.setCustomRte(...)` in
 * lib/plugins/rte) and scoped to the Rich Text block. This component listens
 * for the `tc-rte:*` editor events that plugin emits: `enable` hands over the
 * live `EditorView` and the component being edited, `update` fires on every
 * transaction (each caret move) so the toggle states re-read `view.state`, and
 * `disable` tears the toolbar down. Positioning uses `CanvasFloating` — the
 * same floating-ui wrapper `FloatingToolbar` / `FloatingBadge` use — so the
 * toolbar stays on-screen against the real viewport.
 */
export function RteToolbar() {
  const editor = useEditorMaybe()
  const [view, setView] = React.useState<EditorView | null>(null)
  const [component, setComponent] = React.useState<Component | null>(null)
  // Single inline block mount (a `<p>`/`<h1>`/…): hide block-level controls.
  const [inline, setInline] = React.useState(false)
  // Bumped on every transaction so toggle states re-render from view.state.
  const [, bump] = React.useReducer((n: number) => n + 1, 0)

  React.useEffect(() => {
    if (!editor) return

    const onEnable = (props: {
      view: EditorView
      component?: Component
      inline?: boolean
    }) => {
      setView(props.view)
      setComponent(props.component ?? editor.getEditing() ?? null)
      setInline(!!props.inline)
    }
    const onUpdate = () => bump()
    const onDisable = () => {
      setView(null)
      setComponent(null)
      setInline(false)
    }

    editor.on(RTE_EVENTS.enable, onEnable)
    editor.on(RTE_EVENTS.update, onUpdate)
    editor.on(RTE_EVENTS.disable, onDisable)
    return () => {
      editor.off(RTE_EVENTS.enable, onEnable)
      editor.off(RTE_EVENTS.update, onUpdate)
      editor.off(RTE_EVENTS.disable, onDisable)
    }
  }, [editor])

  if (!editor || !view || !component) {
    // Keep CanvasFloating mounted (target: null) so its hooks stay stable.
    return <CanvasFloating target={null}>{null}</CanvasFloating>
  }

  const fieldProps = { view }

  return (
    <CanvasFloating
      target={component}
      placement="top-start"
      fallbacks={["bottom-start", "top-end", "bottom-end"]}
    >
      {/* Root guard: outside GrapesJS' own toolbar container we lose its
          `mousedown → stopPropagation`, so a click here would reach the top
          document and end the editing session. Stop it at the root.

          `w-max` + `max-w`: floating-ui positions this absolutely, where a
          flex-wrap box with only a max-width collapses to one icon per row.
          `w-max` sizes it to the single-row width, then max-w reflows it. */}
      <TooltipProvider delay={300}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="flex w-max flex-wrap items-center gap-0.5 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <MarkToggles view={view} />
          <ImageControl view={view} editor={editor} />
          <LinkControl {...fieldProps} />

          {!inline && (
            <>
              <Divider />
              <ListToggles view={view} />
              <ActionButton view={view} label="Outdent" onRun={(v) => runCmd(v, indent(-1))}>
                <IndentDecrease />
              </ActionButton>
              <ActionButton view={view} label="Indent" onRun={(v) => runCmd(v, indent(1))}>
                <IndentIncrease />
              </ActionButton>
            </>
          )}

          <Divider />
          <ColorControl view={view} attr="color" label="Text color">
            <Baseline />
          </ColorControl>
          <ColorControl view={view} attr="backgroundColor" label="Highlight">
            <Highlighter />
          </ColorControl>

          <Divider />
          {!inline && <AlignSelect {...fieldProps} />}
          {!inline && <BlockFormatSelect {...fieldProps} />}
          <FontSizeSelect {...fieldProps} />
        </div>
      </TooltipProvider>
    </CanvasFloating>
  )
}
