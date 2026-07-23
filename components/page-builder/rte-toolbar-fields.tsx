"use client"

import * as React from "react"
import type { EditorView } from "prosemirror-view"
import { Link as LinkIcon } from "lucide-react"

import {
  BLOCK_FORMATS,
  applyLink,
  applyTextStyle,
  blockFormat,
  linkAt,
  removeLink,
  runCmd,
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
import { useThemeSelector } from "@/hooks/use-theme"
import { cn } from "@/lib/utils"

/**
 * Popups portal to `document.body`, outside the RTE toolbar container — and
 * GrapesJS disables editing on any `mousedown` that reaches the top document.
 * GrapesJS shields its own toolbar with a container-level `stopPropagation`;
 * portalled content has to shield itself.
 */
const keepEditing = (e: React.MouseEvent) => e.stopPropagation()

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
        className="h-7 w-28 text-xs"
        aria-label="Block format"
        title="Block format"
      >
        <SelectValue placeholder="Format">
          {(val) =>
            BLOCK_FORMATS.find((f) => f.tag === val)?.label ?? "Format"
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent onMouseDown={keepEditing}>
        {BLOCK_FORMATS.map((format) => (
          <SelectItem key={format.tag} value={format.tag} className="text-xs">
            {format.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
        className={cn("h-7 text-xs", className)}
        aria-label={label}
        title={label}
      >
        <SelectValue placeholder={label}>{() => label}</SelectValue>
      </SelectTrigger>
      <SelectContent onMouseDown={keepEditing}>
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

export function FontFamilySelect({ view }: RteFieldProps) {
  const tokens = useThemeSelector(
    (s) => s.theme.settings.typography?.fontFamilies
  )
  return (
    <TokenSelect
      view={view}
      label="Font"
      attr="fontFamily"
      cssProp="font-family"
      tokens={tokens ?? []}
      className="w-24"
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
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={label}
            title={label}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted [&_svg:not([class*='size-'])]:size-4"
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-64 gap-3 p-3"
        onMouseDown={keepEditing}
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
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label="Link"
            title="Link"
            aria-pressed={active}
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-md text-sm transition-colors hover:bg-muted aria-pressed:bg-muted [&_svg:not([class*='size-'])]:size-4"
          />
        }
      >
        <LinkIcon />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 gap-3 p-3"
        onMouseDown={keepEditing}
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
