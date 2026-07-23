"use client"

import * as React from "react"
import { useEditorMaybe } from "@grapesjs/react"
import type { Component } from "grapesjs"
import { deleteSelection } from "prosemirror-commands"
import type { Command, EditorState } from "prosemirror-state"
import type { EditorView } from "prosemirror-view"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  ClipboardPaste,
  Copy,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  RemoveFormatting,
  Scissors,
  Strikethrough,
  Subscript,
  Superscript,
  Trash2,
  Underline,
  Undo2,
} from "lucide-react"

import {
  MARK_COMMANDS,
  alignActive,
  indent,
  insertHorizontalRule,
  listActive,
  markActive,
  redoCmd,
  removeFormat,
  RTE_EVENTS,
  runCmd,
  setAlign,
  toggleInlineMark,
  toggleList,
  undoCmd,
} from "@/lib/plugins/rte"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"

import { CanvasFloating } from "./canvas-floating"
import {
  BlockFormatSelect,
  ColorControl,
  FontFamilySelect,
  FontSizeSelect,
  LinkControl,
} from "./rte-toolbar-fields"

type ActionSpec = {
  name: string
  title: string
  icon: React.ReactNode
  /** Imperative apply against the live view. */
  run: (view: EditorView) => void
  /** Pressed (toggle) state. */
  active?: (state: EditorState) => boolean
  /** Enabled check; defaults to always-enabled. */
  enabled?: (state: EditorState) => boolean
}

/** Build a spec from a ProseMirror Command (dry-run drives the disabled state). */
const cmd = (
  base: Omit<ActionSpec, "run" | "enabled">,
  command: Command
): ActionSpec => ({
  ...base,
  run: (view) => runCmd(view, command),
  enabled: (state) => command(state),
})

/** Run a browser clipboard command inside the canvas iframe document. */
const clipboard =
  (op: "copy" | "cut") =>
  (view: EditorView): void => {
    view.focus()
    view.dom.ownerDocument.execCommand(op)
  }

const paste = (view: EditorView): void => {
  view.focus()
  navigator.clipboard?.readText().then(
    (text) => {
      if (text) view.dispatch(view.state.tr.insertText(text))
    },
    () => {}
  )
}

const markSpec = (
  name: keyof typeof MARK_COMMANDS,
  title: string,
  icon: React.ReactNode
): ActionSpec => {
  const type = MARK_COMMANDS[name]
  return cmd(
    { name, title, icon, active: (s) => markActive(s, type) },
    toggleInlineMark(type)
  )
}

// Groups in toolbar order. `link` is not here — it renders as <LinkControl> in
// the fields row. The block-format / font / colour controls also live there.
const GROUPS: ActionSpec[][] = [
  [
    markSpec("bold", "Bold", <Bold />),
    markSpec("italic", "Italic", <Italic />),
    markSpec("underline", "Underline", <Underline />),
    markSpec("strikethrough", "Strikethrough", <Strikethrough />),
    markSpec("subscript", "Subscript", <Subscript />),
    markSpec("superscript", "Superscript", <Superscript />),
  ],
  [
    cmd(
      {
        name: "insertUnorderedList",
        title: "Bulleted list",
        icon: <List />,
        active: (s) => listActive(s, false),
      },
      toggleList(false)
    ),
    cmd(
      {
        name: "insertOrderedList",
        title: "Numbered list",
        icon: <ListOrdered />,
        active: (s) => listActive(s, true),
      },
      toggleList(true)
    ),
    cmd({ name: "outdent", title: "Outdent", icon: <IndentDecrease /> }, indent(-1)),
    cmd({ name: "indent", title: "Indent", icon: <IndentIncrease /> }, indent(1)),
  ],
  [
    cmd(
      {
        name: "justifyLeft",
        title: "Align left",
        icon: <AlignLeft />,
        active: (s) => alignActive(s, "left"),
      },
      setAlign("left")
    ),
    cmd(
      {
        name: "justifyCenter",
        title: "Align center",
        icon: <AlignCenter />,
        active: (s) => alignActive(s, "center"),
      },
      setAlign("center")
    ),
    cmd(
      {
        name: "justifyRight",
        title: "Align right",
        icon: <AlignRight />,
        active: (s) => alignActive(s, "right"),
      },
      setAlign("right")
    ),
    cmd(
      {
        name: "justifyFull",
        title: "Justify",
        icon: <AlignJustify />,
        active: (s) => alignActive(s, "justify"),
      },
      setAlign("justify")
    ),
  ],
  [
    cmd(
      { name: "insertHorizontalRule", title: "Horizontal line", icon: <Minus /> },
      insertHorizontalRule
    ),
    cmd(
      {
        name: "removeFormat",
        title: "Clear formatting",
        icon: <RemoveFormatting />,
      },
      removeFormat
    ),
  ],
  [
    { name: "copy", title: "Copy", icon: <Copy />, run: clipboard("copy") },
    { name: "cut", title: "Cut", icon: <Scissors />, run: clipboard("cut") },
    { name: "paste", title: "Paste", icon: <ClipboardPaste />, run: paste },
    cmd({ name: "delete", title: "Delete", icon: <Trash2 /> }, deleteSelection),
  ],
  [
    cmd({ name: "undo", title: "Undo", icon: <Undo2 /> }, undoCmd),
    cmd({ name: "redo", title: "Redo", icon: <Redo2 /> }, redoCmd),
  ],
]

function ActionToggle({
  view,
  spec,
}: {
  view: EditorView
  spec: ActionSpec
}) {
  const state = view.state
  const pressed = spec.active?.(state) ?? false
  const disabled = spec.enabled ? !spec.enabled(state) : false

  return (
    <Toggle
      size="sm"
      className="h-7 min-w-7 px-1.5"
      aria-label={spec.title}
      title={spec.title}
      pressed={pressed}
      disabled={disabled}
      // Capture phase: GrapesJS stops `mousedown` bubbling out of the toolbar,
      // so React's delegated onMouseDown never fires. preventDefault keeps DOM
      // focus off the button; the ProseMirror selection lives in view.state,
      // and `runCmd` re-focuses the view before dispatching.
      onMouseDownCapture={(e) => e.preventDefault()}
      onPressedChange={() => spec.run(view)}
    >
      {spec.icon}
    </Toggle>
  )
}

/**
 * The rich-text toolbar.
 *
 * The RTE engine is ProseMirror (swapped in via `editor.setCustomRte(...)` in
 * lib/plugins/rte). This component listens for the `tc-rte:*` editor events
 * that plugin emits: `enable` hands over the live `EditorView` and the
 * component being edited, `update` fires on every transaction (each caret move)
 * so the toggle states re-read `view.state`, and `disable` tears the toolbar
 * down. Positioning uses `CanvasFloating` — the same floating-ui wrapper
 * `FloatingToolbar` / `FloatingBadge` use — so the toolbar stays on-screen
 * against the real viewport.
 */
export function RteToolbar() {
  const editor = useEditorMaybe()
  const [view, setView] = React.useState<EditorView | null>(null)
  const [component, setComponent] = React.useState<Component | null>(null)
  // Bumped on every transaction so toggle states re-render from view.state.
  const [, bump] = React.useReducer((n: number) => n + 1, 0)

  React.useEffect(() => {
    if (!editor) return

    const onEnable = (props: { view: EditorView; component?: Component }) => {
      setView(props.view)
      setComponent(props.component ?? editor.getEditing() ?? null)
    }
    const onUpdate = () => bump()
    const onDisable = () => {
      setView(null)
      setComponent(null)
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
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-max max-w-[39rem] flex-wrap items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <BlockFormatSelect {...fieldProps} />
        <FontSizeSelect {...fieldProps} />
        <FontFamilySelect {...fieldProps} />
        <ColorControl view={view} attr="color" label="Text color">
          <Baseline />
        </ColorControl>
        <ColorControl view={view} attr="backgroundColor" label="Highlight">
          <Highlighter />
        </ColorControl>
        <LinkControl {...fieldProps} />

        {GROUPS.map((group, i) => (
          <React.Fragment key={i}>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            {group.map((spec) => (
              <ActionToggle key={spec.name} view={view} spec={spec} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </CanvasFloating>
  )
}
