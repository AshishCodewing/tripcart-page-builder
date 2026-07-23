"use client"

import * as React from "react"
import { Link as LinkIcon } from "lucide-react"

import {
  BLOCK_FORMATS,
  applyBlockFormat,
  applyInlineStyle,
  findAnchor,
  readBlockFormat,
  restoreRange,
  unlinkAt,
  wrapSelectionEl,
  type Rte,
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
 * `ComponentTextView.toggleEvents` disables editing on any `mousedown` that
 * reaches the top document. GrapesJS shields its own toolbar with a container
 * -level `stopPropagation`; portalled content has to shield itself.
 */
const keepEditing = (e: React.MouseEvent) => e.stopPropagation()

export type RteFieldProps = {
  rte: Rte
  /** Last selection made inside the edited element (popups steal focus). */
  getRange: () => Range | null
  /** Re-measure the toolbar / refresh action states after a change. */
  onApplied: () => void
}

/**
 * Set one inline declaration on the selection. Uses `applyInlineStyle`, which
 * updates an existing wrapping span in place instead of nesting a fresh span
 * on every apply.
 */
const applyStyle = (
  { rte, getRange, onApplied }: RteFieldProps,
  property: string,
  value: string
) => {
  restoreRange(rte, getRange())
  applyInlineStyle(rte, property, value)
  onApplied()
}

export function BlockFormatSelect(props: RteFieldProps) {
  const { rte, getRange, onApplied } = props
  // Read on render: the parent re-renders on every `rte:custom`, which fires
  // after each caret move, so this tracks the block under the cursor.
  const current = readBlockFormat(rte)

  return (
    <Select
      value={current}
      onValueChange={(next) => {
        if (!next || typeof next !== "string") return
        restoreRange(rte, getRange())
        applyBlockFormat(rte, next)
        onApplied()
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
 * properties, so re-theming the tenant restyles existing content — unlike the
 * `<font size="1..7">` tags the upstream plugin's execCommand produced.
 *
 * Acts as a command menu, not a state: the value resets after each apply
 * because the selection's computed size isn't read back.
 */
function TokenSelect({
  field,
  label,
  property,
  tokens,
  className,
}: {
  field: RteFieldProps
  label: string
  property: string
  tokens: { slug: string; name?: string }[]
  className?: string
}) {
  const [value, setValue] = React.useState("")

  if (!tokens.length) return null

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        if (!next || typeof next !== "string") return
        applyStyle(field, property, next)
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
            value={`var(--tc--preset--${property}--${kebab(token.slug)})`}
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

export function FontSizeSelect(props: RteFieldProps) {
  const tokens = useThemeSelector(
    (s) => s.theme.settings.typography?.fontSizes
  )
  return (
    <TokenSelect
      field={props}
      label="Size"
      property="font-size"
      tokens={tokens ?? []}
      className="w-20"
    />
  )
}

export function FontFamilySelect(props: RteFieldProps) {
  const tokens = useThemeSelector(
    (s) => s.theme.settings.typography?.fontFamilies
  )
  return (
    <TokenSelect
      field={props}
      label="Font"
      property="font-family"
      tokens={tokens ?? []}
      className="w-24"
    />
  )
}

/**
 * Font colour / highlight. Theme swatches come first (they commit
 * `var(--tc--preset--color--…)`), with the full picker below for one-off
 * colours — same composite the Style Manager's colour field uses.
 */
export function ColorControl({
  field,
  property,
  label,
  children,
}: {
  field: RteFieldProps
  property: "color" | "background-color"
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
            // Dragging the canvas emits partial commits; wrapping on each one
            // would litter the markup with a span per frame.
            if (opts?.partial) return
            applyStyle(field, property, next)
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
 * Link control: a toggle (pressed while the caret is inside an `<a>`) that
 * opens a popover to set the anchor's URL, title and target. Replaces the
 * default `link` action, whose `result` closes the RTE and only ever creates a
 * bare `<a href="">`.
 *
 * `active` comes from the built-in `link` action's `currentState`, so the
 * pressed styling tracks the caret exactly like the other toggles.
 */
export function LinkControl({
  field,
  active,
}: {
  field: RteFieldProps
  active: boolean
}) {
  const { rte, getRange, onApplied } = field
  const [open, setOpen] = React.useState(false)
  const [href, setHref] = React.useState("")
  const [title, setTitle] = React.useState("")
  const [target, setTarget] = React.useState<string>("_self")
  // Whether the popover opened on an existing link (drives the Remove button).
  const [hasLink, setHasLink] = React.useState(false)

  const onOpenChange = (next: boolean) => {
    if (next) {
      // Prefill from the anchor under the caret. Read from the captured range
      // rather than the live selection: opening the popover moves focus out of
      // the iframe.
      const anchor = findAnchor(rte, getRange())
      const anchorTarget = anchor?.getAttribute("target")
      setHasLink(!!anchor)
      setHref(anchor?.getAttribute("href") ?? "")
      setTitle(anchor?.getAttribute("title") ?? "")
      setTarget(
        anchorTarget && LINK_TARGETS.some((t) => t.value === anchorTarget)
          ? anchorTarget
          : "_self"
      )
    }
    setOpen(next)
  }

  const writeAttrs = (el: HTMLElement) => {
    if (href) el.setAttribute("href", href)
    else el.removeAttribute("href")
    if (title) el.setAttribute("title", title)
    else el.removeAttribute("title")
    if (target && target !== "_self") {
      el.setAttribute("target", target)
      // Standard hardening when opening a new browsing context.
      if (target === "_blank") el.setAttribute("rel", "noopener noreferrer")
      else el.removeAttribute("rel")
    } else {
      el.removeAttribute("target")
      el.removeAttribute("rel")
    }
  }

  const apply = () => {
    restoreRange(rte, getRange())
    const anchor = findAnchor(rte)
    if (anchor) {
      // Editing an existing link: mutate its attributes in place. GrapesJS
      // captures the DOM on disableEditing, so this round-trips on blur.
      writeAttrs(anchor)
    } else if (!wrapSelectionEl(rte, "a", writeAttrs) && href) {
      // Collapsed caret with no existing link: insert a fresh link whose text
      // is the title (or the URL) so there's something to click.
      const link = rte.doc.createElement("a")
      writeAttrs(link)
      link.textContent = title || href
      rte.insertHTML(link)
    }
    onApplied()
    setOpen(false)
  }

  const remove = () => {
    restoreRange(rte, getRange())
    const anchor = findAnchor(rte)
    if (anchor) unlinkAt(anchor)
    onApplied()
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
          <Button
            type="button"
            size="sm"
            className="text-xs"
            onClick={apply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
