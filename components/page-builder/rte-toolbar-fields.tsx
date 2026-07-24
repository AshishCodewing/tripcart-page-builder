"use client"

import * as React from "react"
import type { Editor } from "grapesjs"
import type { EditorView } from "prosemirror-view"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Image as ImageIcon,
  Link as LinkIcon,
} from "lucide-react"

import {
  ALIGNMENTS,
  BLOCK_FORMATS,
  alignActive,
  applyImage,
  applyLink,
  applyTextStyle,
  blockFormat,
  linkAt,
  removeLink,
  runCmd,
  setAlign,
  setBlockFormat,
  type TextStyleAttr,
} from "@/lib/plugins/rte"
import { Button } from "@/components/ui/button"
import {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
} from "@/components/ui/color-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useThemeSelector } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

/** Shared classes for an icon-only toolbar button (matches the mark toggles). */
const ICON_BTN =
  "size-8 [&_svg:not([class*='size-'])]:size-4 aria-pressed:bg-muted"

/**
 * Popups portal to `document.body`, outside the RTE toolbar container — and
 * GrapesJS disables editing on any `mousedown` that reaches the top document.
 * GrapesJS shields its own toolbar with a container-level `stopPropagation`;
 * portalled content has to shield itself.
 */
const keepEditing = (e: React.MouseEvent) => e.stopPropagation()

/**
 * `finalFocus` for a base-ui Select/Popover popup: on close, refocus the
 * ProseMirror editor (restoring its selection) instead of the trigger button,
 * and return `false` so base-ui doesn't move focus itself. Without this the
 * canvas is left blurred after picking a value, so typing wouldn't resume until
 * the user clicked back into the text.
 */
const returnFocus = (view: EditorView) => () => {
  view.focus()
  return false
}

export type RteFieldProps = {
  /** The live ProseMirror view being edited. */
  view: EditorView
}

export function BlockFormatSelect({ view }: RteFieldProps) {
  // Read on render: the toolbar re-renders on every `tc-rte:update` (each
  // selection change), so this tracks the block under the cursor.
  const current = blockFormat(view.state)

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        if (typeof next !== "string" || !next) return
        runCmd(view, setBlockFormat(next))
      }}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-28 text-xs"
        aria-label="Block format"
      >
        <SelectValue placeholder="Format">
          {(val) =>
            BLOCK_FORMATS.find((f) => f.tag === val)?.label ?? "Format"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent onMouseDown={keepEditing} finalFocus={returnFocus(view)}>
        {BLOCK_FORMATS.map((format) => (
          <SelectItem key={format.tag} value={format.tag} className="text-xs">
            {format.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const ALIGN_META = [
  { value: "left", label: "Align left", icon: <AlignLeft /> },
  { value: "center", label: "Align center", icon: <AlignCenter /> },
  { value: "right", label: "Align right", icon: <AlignRight /> },
  { value: "justify", label: "Justify", icon: <AlignJustify /> },
] as const

/** Text-alignment as a single dropdown (replaces the four align buttons). */
export function AlignSelect({ view }: RteFieldProps) {
  const current = ALIGNMENTS.find((a) => alignActive(view.state, a)) ?? "left"

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        // `setAlign` toggles to null when re-picking the active value; the
        // Select never fires for the current item, so a pick always sets.
        if (typeof next !== "string" || next === current) return
        runCmd(view, setAlign(next as (typeof ALIGNMENTS)[number]))
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <SelectTrigger
              size="sm"
              className="h-8 w-14 px-1.5 [&_svg:not([class*='size-'])]:size-4"
              aria-label="Alignment"
            >
              <SelectValue>
                {(val) =>
                  ALIGN_META.find((a) => a.value === val)?.icon ?? <AlignLeft />
                }
              </SelectValue>
            </SelectTrigger>
          }
        />
        <TooltipContent>Alignment</TooltipContent>
      </Tooltip>
      <SelectContent onMouseDown={keepEditing} finalFocus={returnFocus(view)}>
        {ALIGN_META.map((a) => (
          <SelectItem key={a.value} value={a.value} className="text-xs">
            <span className="flex items-center gap-2">
              {a.icon}
              {a.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Insert an image at the caret via GrapesJS' Asset Manager (mirrors the
 * style-fields FileField flow), writing an `image` node into the RTE document.
 */
export function ImageControl({
  view,
  editor,
}: RteFieldProps & { editor: Editor }) {
  const open = () => {
    editor.AssetManager.open({
      types: ["image"],
      select: (asset, complete) => {
        const src = typeof asset === "string" ? asset : asset.getSrc()
        if (src) applyImage(view, { src })
        if (complete) {
          editor.AssetManager.close()
          // Closing GrapesJS' modal restores focus away from the canvas; put it
          // back on the editor once the close settles so typing resumes.
          requestAnimationFrame(() => view.focus())
        }
      },
    })
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className={ICON_BTN}
            aria-label="Insert image"
            onMouseDownCapture={(e) => e.preventDefault()}
            onClick={open}
          >
            <ImageIcon />
          </Button>
        }
      />
      <TooltipContent>Insert image</TooltipContent>
    </Tooltip>
  )
}

/**
 * Theme-token dropdown (font size / family). Values are the preset custom
 * properties, so re-theming the tenant restyles existing content. Acts as a
 * command menu, not a state: the value resets after each apply.
 */
function TokenSelect({
  view,
  label,
  attr,
  cssProp,
  tokens,
  className,
}: {
  view: EditorView
  label: string
  attr: TextStyleAttr
  cssProp: string
  tokens: { slug: string; name?: string }[]
  className?: string
}) {
  const [value, setValue] = React.useState("")

  if (!tokens.length) return null

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (typeof next !== "string" || !next) return
        applyTextStyle(view, attr, next)
        setValue("")
      }}
    >
      <SelectTrigger
        size="sm"
        className={cn("h-8 text-xs", className)}
        aria-label={label}
      >
        <SelectValue placeholder={label}>{() => label}</SelectValue>
      </SelectTrigger>
      <SelectContent onMouseDown={keepEditing} finalFocus={returnFocus(view)}>
        {tokens.map((token) => (
          <SelectItem
            key={token.slug}
            value={`var(--tc--preset--${cssProp}--${kebab(token.slug)})`}
            className="text-xs"
          >
            {token.name || token.slug}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const kebab = (slug: string) =>
  slug.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)

/** The `target` options, in menu order. `_self` clears the attribute. */
const LINK_TARGETS = [
  { value: "_self", label: "Current window" },
  { value: "_blank", label: "New window" },
] as const

export function FontSizeSelect({ view }: RteFieldProps) {
  const tokens = useThemeSelector(
    (s) => s.theme.settings.typography?.fontSizes
  )
  return (
    <TokenSelect
      view={view}
      label="Size"
      attr="fontSize"
      cssProp="font-size"
      tokens={tokens ?? []}
      className="w-20"
    />
  )
}

/**
 * Font colour / highlight. Theme swatches come first (they commit
 * `var(--tc--preset--color--…)`), with the full picker below for one-off
 * colours. Both write onto the `textStyle` mark.
 */
export function ColorControl({
  view,
  attr,
  label,
  children,
}: {
  view: EditorView
  attr: Extract<TextStyleAttr, "color" | "backgroundColor">
  label: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState("")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={ICON_BTN}
                  aria-label={label}
                >
                  {children}
                </Button>
              }
            />
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 gap-3 p-3"
        onMouseDown={keepEditing}
        finalFocus={returnFocus(view)}
      >
        <ColorPicker
          value={value}
          onChange={(next, opts) => {
            setValue(next)
            // Dragging the canvas emits partial commits; applying on each one
            // would thrash the mark on every frame.
            if (opts?.partial) return
            applyTextStyle(view, attr, next)
            setOpen(false)
          }}
        >
          <ColorPickerSwatches />
          <ColorPickerCanvas />
          <ColorPickerChannels />
        </ColorPicker>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Link control: a toggle (pressed while the caret is inside a link) that opens
 * a popover to set the anchor's URL, title and target — driven by the `link`
 * mark in the ProseMirror schema.
 */
export function LinkControl({ view }: RteFieldProps) {
  const active = !!linkAt(view.state)
  const [open, setOpen] = React.useState(false)
  const [href, setHref] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [target, setTarget] = React.useState<string>("_self")
  const [hasLink, setHasLink] = React.useState(false)

  const onOpenChange = (next: boolean) => {
    if (next) {
      const link = linkAt(view.state)
      const linkTarget = link?.target
      setHasLink(!!link)
      setHref(link?.href ?? "")
      setTitle(link?.title ?? "")
      setTarget(
        linkTarget && LINK_TARGETS.some((t) => t.value === linkTarget)
          ? linkTarget
          : "_self"
      )
    }
    setOpen(next)
  }

  const apply = () => {
    const rel = target === "_blank" ? "noopener noreferrer" : null
    applyLink(
      view,
      {
        href: href || null,
        title: title || null,
        target: target !== "_self" ? target : null,
        rel: target !== "_self" ? rel : null,
      },
      title || href
    )
    setOpen(false)
  }

  const remove = () => {
    runCmd(view, removeLink)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={ICON_BTN}
                  aria-label="Link"
                  aria-pressed={active}
                >
                  <LinkIcon />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Link</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 gap-3 p-3"
        onMouseDown={keepEditing}
        finalFocus={returnFocus(view)}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="rte-link-url" className="text-xs">
            Link
          </Label>
          <Input
            id="rte-link-url"
            inputSize="sm"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="https://example.com"
            className="text-xs"
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rte-link-title" className="text-xs">
            Title
          </Label>
          <Input
            id="rte-link-title"
            inputSize="sm"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tooltip text (optional)"
            className="text-xs"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rte-link-target" className="text-xs">
            Open Link In
          </Label>
          <Select
            value={target}
            onValueChange={(next) => {
              if (typeof next === "string") setTarget(next)
            }}
          >
            <SelectTrigger
              id="rte-link-target"
              size="sm"
              className="w-full text-xs"
              aria-label="Link target"
            >
              <SelectValue>
                {(val) =>
                  LINK_TARGETS.find((t) => t.value === val)?.label ??
                  "Current window"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent onMouseDown={keepEditing}>
              {LINK_TARGETS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          {hasLink && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mr-auto text-xs text-destructive hover:text-destructive"
              onClick={remove}
            >
              Remove
            </Button>
          )}
          <Button type="button" size="sm" className="text-xs" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
