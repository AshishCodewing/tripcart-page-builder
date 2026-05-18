"use client"

import * as React from "react"
import type { Property } from "grapesjs"
import { useEditor } from "@grapesjs/react"

import {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
} from "@/components/ui/color-picker"
import { Popover, PopoverContent } from "@/components/ui/popover"
import {
  GRAD_OPEN_STOP_PICKER,
  type GradOpenStopPickerDetail,
  type GradientStopHandler,
} from "../editor-shell"

// The grapesjs-style-bg plugin registers a custom Styles type called
// "gradient" via `Styles.addType("gradient", { create, update, destroy })`.
// Those hooks build a Grapick picker into an HTMLElement using `this` as a
// stable state container (the plugin stores `this.gp = grapickInstance`).
//
// Our React Style Manager bypasses GrapesJS's native PropertyView, so we
// invoke the registered type def ourselves: call `create` on mount, append
// its returned element, push value changes through `update`, and cleanup
// via `destroy`. The `_getClbOpts` shape (grapes.min.js) is the contract.
type GradientTypeDef = {
  create?: (data: CallbackData) => HTMLElement | undefined
  update?: (data: CallbackData & { value: string }) => void
  destroy?: (data: CallbackData) => void
  emit?: (data: CallbackData, ...args: unknown[]) => void
}

type CallbackData = {
  el: HTMLElement | null
  createdEl: HTMLElement | null
  property: Property
  props: Record<string, unknown>
  change: (data: { value: string; partial?: boolean }) => void
  updateStyle: (value: string, opts?: { partial?: boolean }) => void
}

type ActiveStop = {
  handler: GradientStopHandler
  anchor: HTMLElement
  color: string
}

export default function GradientField({ property }: { property: Property }) {
  const editor = useEditor()
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const ctxRef = React.useRef<Record<string, unknown>>({})
  const createdElRef = React.useRef<HTMLElement | null>(null)
  // Skip the next "value changed → call update" cycle when the change came
  // from us. Grapick's `update` impl calls `setValue` → `clear` → `remove`
  // on every handler, which zeroes out `handler.gp`. Doing that while a
  // mousedown drag is live causes the document mousemove listener to call
  // methods on a destroyed handler and throw "Cannot read properties of
  // undefined (reading 'apply')" inside `Handler.emit` (which compiles to
  // `(e = this.gp).emit.apply(e, arguments)`).
  const skipNextUpdateRef = React.useRef(false)
  const [activeStop, setActiveStop] = React.useState<ActiveStop | null>(null)

  const currentValue = String(property.getValue() ?? "")

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const typeDef = editor.Styles.getType("gradient") as
      | GradientTypeDef
      | undefined
    if (!typeDef?.create) return

    const ctx = ctxRef.current

    const onInternalChange = ({
      value,
      partial,
    }: {
      value: string
      partial?: boolean
    }) => {
      skipNextUpdateRef.current = true
      property.upValue(value, { partial })
    }

    const makeData = (extra?: Partial<CallbackData>): CallbackData => ({
      el: container,
      createdEl: createdElRef.current,
      property,
      props: (property as unknown as { attributes: Record<string, unknown> })
        .attributes,
      change: onInternalChange,
      updateStyle: (value, opts) =>
        onInternalChange({ value, partial: opts?.partial }),
      ...extra,
    })

    const created = typeDef.create.call(ctx, makeData())
    if (created instanceof HTMLElement) {
      container.appendChild(created)
      createdElRef.current = created
    }

    typeDef.update?.call(ctx, { ...makeData(), value: currentValue })

    return () => {
      typeDef.destroy?.call(ctx, makeData())
      if (createdElRef.current && createdElRef.current.parentNode) {
        createdElRef.current.parentNode.removeChild(createdElRef.current)
      }
      createdElRef.current = null
      ctxRef.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, property])

  React.useEffect(() => {
    if (skipNextUpdateRef.current) {
      skipNextUpdateRef.current = false
      return
    }
    const container = containerRef.current
    if (!container) return
    const typeDef = editor.Styles.getType("gradient") as
      | GradientTypeDef
      | undefined
    if (!typeDef?.update) return
    typeDef.update.call(ctxRef.current, {
      el: container,
      createdEl: createdElRef.current,
      property,
      props: (property as unknown as { attributes: Record<string, unknown> })
        .attributes,
      change: ({ value, partial }) => property.upValue(value, { partial }),
      updateStyle: (value, opts) =>
        property.upValue(value, { partial: opts?.partial }),
      value: currentValue,
    })
  }, [editor, property, currentValue])

  // Listen for "swatch was clicked" events bubbling up from Grapick's stop
  // handles (dispatched by gradientStopColorPicker in editor-shell.tsx).
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<GradOpenStopPickerDetail>).detail
      setActiveStop({
        handler: detail.handler,
        anchor: detail.anchor,
        color: detail.color,
      })
    }
    container.addEventListener(GRAD_OPEN_STOP_PICKER, onOpen)
    return () => container.removeEventListener(GRAD_OPEN_STOP_PICKER, onOpen)
  }, [])

  return (
    <>
      <div ref={containerRef} className="w-full my-2" />
      <Popover
        open={!!activeStop}
        onOpenChange={(open) => {
          if (!open) setActiveStop(null)
        }}
      >
        <PopoverContent
          anchor={activeStop?.anchor}
          align="start"
          sideOffset={6}
          className="w-64 gap-3 p-3"
        >
          {activeStop ? (
            <ColorPicker
              value={activeStop.color}
              onChange={(next, opts) => {
                // Grapick's setColor takes (color, complete) where complete=1
                // commits to history and complete=0 is a drag-in-progress.
                activeStop.handler.setColor(next, opts?.partial ? 0 : 1)
                // Grapick only repaints the swatch from its own native-input
                // handler (which we stripped), so mirror the color manually.
                activeStop.anchor.style.backgroundColor = next
                setActiveStop({ ...activeStop, color: next })
              }}
            >
              <ColorPickerCanvas />
              <ColorPickerChannels />
            </ColorPicker>
          ) : null}
        </PopoverContent>
      </Popover>
    </>
  )
}
