"use client"

import * as React from "react"
import { useEditorMaybe } from "@grapesjs/react"
import type {
  Component,
  Editor,
  RichTextEditorAction,
  RichTextEditorCustomEventProps,
} from "grapesjs"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Brush,
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

import { RTE_STATE, captureRange, type Rte } from "@/lib/plugins/rte"
import { Separator } from "@/components/ui/separator"
import { Toggle } from "@/components/ui/toggle"

import { CanvasFloating } from "./canvas-floating"
import {
  BlockFormatSelect,
  ColorControl,
  FontFamilySelect,
  FontSizeSelect,
  LinkControl,
  type RteFieldProps,
} from "./rte-toolbar-fields"

type ActionSpec = { name: string; title: string; icon: React.ReactNode }

// Groups in toolbar order. Every name is a registered RTE action: the first
// group is GrapesJS' own default set, the rest come from lib/plugins/rte.
const GROUPS: ActionSpec[][] = [
  [
    { name: "bold", title: "Bold", icon: <Bold /> },
    { name: "italic", title: "Italic", icon: <Italic /> },
    { name: "underline", title: "Underline", icon: <Underline /> },
    {
      name: "strikethrough",
      title: "Strikethrough",
      icon: <Strikethrough />,
    },
    { name: "subscript", title: "Subscript", icon: <Subscript /> },
    { name: "superscript", title: "Superscript", icon: <Superscript /> },
  ],
  // `link` is not here — it's rendered as <LinkControl> (a toggle + popover)
  // in the fields row below.
  [{ name: "wrap", title: "Wrap for style", icon: <Brush /> }],
  [
    { name: "insertUnorderedList", title: "Bulleted list", icon: <List /> },
    {
      name: "insertOrderedList",
      title: "Numbered list",
      icon: <ListOrdered />,
    },
    { name: "outdent", title: "Outdent", icon: <IndentDecrease /> },
    { name: "indent", title: "Indent", icon: <IndentIncrease /> },
  ],
  [
    { name: "justifyLeft", title: "Align left", icon: <AlignLeft /> },
    { name: "justifyCenter", title: "Align center", icon: <AlignCenter /> },
    { name: "justifyRight", title: "Align right", icon: <AlignRight /> },
    { name: "justifyFull", title: "Justify", icon: <AlignJustify /> },
  ],
  [
    {
      name: "insertHorizontalRule",
      title: "Horizontal line",
      icon: <Minus />,
    },
    {
      name: "removeFormat",
      title: "Clear formatting",
      icon: <RemoveFormatting />,
    },
  ],
  [
    { name: "copy", title: "Copy", icon: <Copy /> },
    { name: "cut", title: "Cut", icon: <Scissors /> },
    { name: "paste", title: "Paste", icon: <ClipboardPaste /> },
    { name: "delete", title: "Delete", icon: <Trash2 /> },
  ],
  [
    { name: "undo", title: "Undo", icon: <Undo2 /> },
    { name: "redo", title: "Redo", icon: <Redo2 /> },
  ],
]

function ActionToggle({
  editor,
  action,
  spec,
}: {
  editor: Editor
  action: RichTextEditorAction | undefined
  spec: ActionSpec
}) {
  const state = action?.currentState ?? RTE_STATE.INACTIVE

  return (
    <Toggle
      size="sm"
      className="h-7 min-w-7 px-1.5"
      aria-label={spec.title}
      title={spec.title}
      pressed={state === RTE_STATE.ACTIVE}
      disabled={!action || state === RTE_STATE.DISABLED}
      // Capture phase: GrapesJS stops `mousedown` from bubbling out of the
      // toolbar container, so React's delegated (bubble) onMouseDown never
      // fires here. preventDefault keeps focus — and therefore the frame's
      // selection — on the contenteditable, which execCommand needs.
      onMouseDownCapture={(e) => e.preventDefault()}
      onPressedChange={() => editor.RichTextEditor.run(spec.name)}
    >
      {spec.icon}
    </Toggle>
  )
}

/**
 * The rich-text toolbar.
 *
 * `richTextEditor: { custom: true }` (see editor-config/build-options.ts) tells
 * GrapesJS not to draw its own action bar. It still creates and shows/hides a
 * toolbar container, but we ignore that container and position ourselves with
 * `CanvasFloating` — the same floating-ui wrapper `FloatingToolbar` /
 * `FloatingBadge` use — so the toolbar flips and shifts to stay on-screen
 * against the real viewport (GrapesJS' own positioning only flips at the canvas
 * frame edge and never accounts for the surrounding panels).
 *
 * `rte:custom` re-fires (debounced) after every `updateActiveActions()` — i.e.
 * on each caret move — carrying the action list whose `currentState` drives the
 * pressed/disabled states below.
 */
export function RteToolbar() {
  const editor = useEditorMaybe()
  const [custom, setCustom] =
    React.useState<RichTextEditorCustomEventProps | null>(null)
  // Last selection made inside the edited element. Opening a select/popover
  // moves focus into the top document; we restore this before applying.
  const rangeRef = React.useRef<Range | null>(null)

  React.useEffect(() => {
    if (!editor) return

    const onCustom = (props: RichTextEditorCustomEventProps) => {
      // Spread: `actions` is a stable array whose `currentState` is mutated in
      // place, so a fresh wrapper object is what makes React re-render.
      setCustom({ ...props })
      const rte = editor.RichTextEditor.globalRte
      if (!props.enabled || !rte) {
        rangeRef.current = null
        return
      }
      const captured = captureRange(rte)
      if (captured) rangeRef.current = captured
    }

    editor.on("rte:custom", onCustom)
    return () => {
      editor.off("rte:custom", onCustom)
    }
  }, [editor])

  const refresh = React.useCallback(() => {
    editor?.RichTextEditor.globalRte?.updateActiveActions()
  }, [editor])

  const rte: Rte | undefined = editor?.RichTextEditor.globalRte
  // The component under edit; `CanvasFloating` anchors to its DOM node. Read
  // during render — `rte:custom` re-renders us on enable/disable, so this
  // tracks the active editing target.
  const editing: Component | null =
    (custom?.enabled && editor?.getEditing()) || null

  if (!editor || !custom?.enabled || !rte || !editing) {
    // Still mount CanvasFloating (target: null) so its hooks stay stable
    // across enable/disable transitions.
    return <CanvasFloating target={null}>{null}</CanvasFloating>
  }

  const actions = custom.actions
  const byName = (name: string) => actions.find((a) => a.name === name)
  const fieldProps: RteFieldProps = {
    rte,
    getRange: () => rangeRef.current,
    onApplied: refresh,
  }

  return (
    <CanvasFloating
      target={editing}
      placement="top-start"
      fallbacks={["bottom-start", "top-end", "bottom-end"]}
    >
      {/* Root guard: outside GrapesJS' own toolbar container we lose its
          `mousedown → stopPropagation`, so a click here would reach the top
          document and `ComponentTextView.toggleEvents` would end the editing
          session. Stop it at the root; buttons additionally preventDefault to
          keep focus on the contenteditable.

          `w-max` + `max-w` (not bare `max-w`): floating-ui positions this
          absolutely, where a flex-wrap box with only a max-width collapses to
          min-content (one icon per row). `w-max` sizes it to the single-row
          intrinsic width, then max-w clamps it so the set reflows into two
          even rows. */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex w-max max-w-[39rem] flex-wrap items-center gap-0.5 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md"
      >
        <BlockFormatSelect {...fieldProps} />
        <FontSizeSelect {...fieldProps} />
        <FontFamilySelect {...fieldProps} />
        <ColorControl field={fieldProps} property="color" label="Text color">
          <Baseline />
        </ColorControl>
        <ColorControl
          field={fieldProps}
          property="background-color"
          label="Highlight"
        >
          <Highlighter />
        </ColorControl>
        <LinkControl
          field={fieldProps}
          active={byName("link")?.currentState === RTE_STATE.ACTIVE}
        />

        {GROUPS.map((group, i) => (
          <React.Fragment key={i}>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            {group.map((spec) => (
              <ActionToggle
                key={spec.name}
                editor={editor}
                action={byName(spec.name)}
                spec={spec}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
    </CanvasFloating>
  )
}
