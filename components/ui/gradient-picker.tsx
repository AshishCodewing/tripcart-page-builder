"use client"

import * as React from "react"
import { ArrowLeftRight, Trash2 } from "lucide-react"
import { colord } from "colord"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
} from "@/components/ui/color-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_GRADIENT,
  RADIAL_POSITIONS,
  coerceDirection,
  degreesToDirection,
  directionToDegrees,
  formatPercent,
  parseGradient,
  radialPositionFromDirection,
  radialPositionToDirection,
  sampleGradientColor,
  stopPercent,
  toGradient,
  type GradientStop,
  type GradientType,
  type ParsedGradient,
  type RadialPosition,
} from "@/lib/gradient"

export type GradientPickerCommitOpts = { partial?: boolean }

const MIN_STOPS = 2
const DRAG_THRESHOLD_PX = 4

const CHECKERBOARD =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill-opacity='.18'><path d='M5 0h5v5H5zM0 5h5v5H0z'/></svg>\")"

// ---------- helpers ----------

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n))

const sortStops = (stops: GradientStop[]): GradientStop[] =>
  [...stops].sort((a, b) => stopPercent(a.position) - stopPercent(b.position))

const baseTypeOf = (t: GradientType): "linear" | "radial" =>
  t === "linear" || t === "repeating-linear" ? "linear" : "radial"

const isRepeating = (t: GradientType): boolean =>
  t === "repeating-linear" || t === "repeating-radial"

const composeType = (
  base: "linear" | "radial",
  repeating: boolean
): GradientType => (repeating ? `repeating-${base}` : base)

// ---------- context ----------

type Ctx = {
  parsed: ParsedGradient
  /** During a drag, the working copy with the moved stop's position updated. */
  effectiveStops: GradientStop[]
  selectedIdx: number
  setSelectedIdx: (idx: number) => void

  setStopColor: (
    idx: number,
    color: string,
    opts?: GradientPickerCommitOpts
  ) => void
  setStopPosition: (
    idx: number,
    pct: number,
    opts?: GradientPickerCommitOpts
  ) => void
  addStop: (pct: number) => void
  removeStop: (idx: number) => void
  flipStops: () => void
  setBaseType: (next: "linear" | "radial") => void
  setRepeating: (next: boolean) => void
  setDirection: (direction: string) => void

  draftStops: GradientStop[] | null
  setDraftStops: (next: GradientStop[] | null) => void
}

const GradientPickerContext = React.createContext<Ctx | null>(null)

const useGradientPicker = () => {
  const ctx = React.useContext(GradientPickerContext)
  if (!ctx) {
    throw new Error(
      "GradientPicker subcomponents must be used inside <GradientPicker>"
    )
  }
  return ctx
}

// ---------- root ----------

export function GradientPicker({
  value,
  onChange,
  className,
  children,
}: {
  value: string
  onChange: (next: string, opts?: GradientPickerCommitOpts) => void
  className?: string
  children?: React.ReactNode
}) {
  const parsed = React.useMemo(
    () => parseGradient(value) ?? DEFAULT_GRADIENT,
    [value]
  )

  const [selectedIdxRaw, setSelectedIdxRaw] = React.useState(0)
  const [draftStops, setDraftStops] = React.useState<GradientStop[] | null>(
    null
  )

  // Clamp selection if a stop was removed externally.
  const selectedIdx = Math.min(
    selectedIdxRaw,
    Math.max(0, parsed.stops.length - 1)
  )
  const setSelectedIdx = React.useCallback(
    (i: number) =>
      setSelectedIdxRaw(clamp(i, 0, Math.max(0, parsed.stops.length - 1))),
    [parsed.stops.length]
  )

  const commit = React.useCallback(
    (
      type: GradientType,
      direction: string,
      stops: GradientStop[],
      opts?: GradientPickerCommitOpts
    ) => {
      onChange(toGradient(type, direction, stops), opts)
    },
    [onChange]
  )

  const setStopColor = React.useCallback(
    (idx: number, color: string, opts?: GradientPickerCommitOpts) => {
      const next = parsed.stops.map((s, i) =>
        i === idx ? { ...s, color } : s
      )
      commit(parsed.type, parsed.direction, next, opts)
    },
    [commit, parsed]
  )

  const setStopPosition = React.useCallback(
    (idx: number, pct: number, opts?: GradientPickerCommitOpts) => {
      const clamped = clamp(pct, 0, 100)
      const next = parsed.stops.map((s, i) =>
        i === idx ? { ...s, position: formatPercent(clamped) } : s
      )
      commit(
        parsed.type,
        parsed.direction,
        opts?.partial ? next : sortStops(next),
        opts
      )
    },
    [commit, parsed]
  )

  const addStop = React.useCallback(
    (pct: number) => {
      const clamped = clamp(pct, 0, 100)
      const color = sampleGradientColor(parsed.stops, clamped / 100)
      const inserted: GradientStop = {
        color,
        position: formatPercent(clamped),
      }
      const next = sortStops([...parsed.stops, inserted])
      commit(parsed.type, parsed.direction, next)
      // Track the new stop's post-sort index so the inline panel reflects it.
      const newIdx = next.findIndex((s) => s === inserted)
      if (newIdx >= 0) setSelectedIdxRaw(newIdx)
    },
    [commit, parsed]
  )

  const removeStop = React.useCallback(
    (idx: number) => {
      if (parsed.stops.length <= MIN_STOPS) return
      const next = parsed.stops.filter((_, i) => i !== idx)
      commit(parsed.type, parsed.direction, next)
      setSelectedIdxRaw((cur) => clamp(cur, 0, next.length - 1))
    },
    [commit, parsed]
  )

  const flipStops = React.useCallback(() => {
    const next = sortStops(
      parsed.stops.map((s) => ({
        ...s,
        position: formatPercent(100 - stopPercent(s.position)),
      }))
    )
    commit(parsed.type, parsed.direction, next)
  }, [commit, parsed])

  const setBaseType = React.useCallback(
    (next: "linear" | "radial") => {
      const target = composeType(next, isRepeating(parsed.type))
      if (target === parsed.type) return
      const dir = coerceDirection(parsed.type, target, parsed.direction)
      commit(target, dir, parsed.stops)
    },
    [commit, parsed]
  )

  const setRepeating = React.useCallback(
    (next: boolean) => {
      const target = composeType(baseTypeOf(parsed.type), next)
      if (target === parsed.type) return
      commit(target, parsed.direction, parsed.stops)
    },
    [commit, parsed]
  )

  const setDirection = React.useCallback(
    (direction: string) => {
      commit(parsed.type, direction, parsed.stops)
    },
    [commit, parsed]
  )

  const ctx: Ctx = {
    parsed,
    effectiveStops: draftStops ?? parsed.stops,
    selectedIdx,
    setSelectedIdx,
    setStopColor,
    setStopPosition,
    addStop,
    removeStop,
    flipStops,
    setBaseType,
    setRepeating,
    setDirection,
    draftStops,
    setDraftStops,
  }

  return (
    <GradientPickerContext.Provider value={ctx}>
      <div
        data-slot="gradient-picker"
        className={cn("flex w-full flex-col gap-3", className)}
      >
        {children}
      </div>
    </GradientPickerContext.Provider>
  )
}

// ---------- track ----------

type DragState = {
  idx: number
  pointerId: number
  startX: number
  barRect: DOMRect
  moved: boolean
  initialStops: GradientStop[]
  lastPct: number
}

export function GradientPickerTrack({ className }: { className?: string }) {
  const {
    parsed,
    effectiveStops,
    selectedIdx,
    setSelectedIdx,
    setStopPosition,
    addStop,
    setDraftStops,
  } = useGradientPicker()

  const barRef = React.useRef<HTMLDivElement | null>(null)
  const dragRef = React.useRef<DragState | null>(null)

  const onPinPointerDown = React.useCallback(
    (idx: number, e: React.PointerEvent<HTMLButtonElement>) => {
      const bar = barRef.current
      if (!bar) return
      // Don't steal focus from inputs while the user is mid-edit elsewhere;
      // the pin still becomes the keyboard target via its own focus call.
      e.preventDefault()
      e.currentTarget.focus()
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = {
        idx,
        pointerId: e.pointerId,
        startX: e.clientX,
        barRect: bar.getBoundingClientRect(),
        moved: false,
        initialStops: parsed.stops,
        lastPct: stopPercent(parsed.stops[idx]?.position ?? "0%"),
      }
      setDraftStops(parsed.stops)
      setSelectedIdx(idx)
    },
    [parsed.stops, setDraftStops, setSelectedIdx]
  )

  const onPinPointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = e.clientX - drag.startX
      if (!drag.moved && Math.abs(dx) < DRAG_THRESHOLD_PX) return
      drag.moved = true
      const { barRect, initialStops, idx } = drag
      const pct = clamp(
        ((e.clientX - barRect.left) / barRect.width) * 100,
        0,
        100
      )
      drag.lastPct = pct
      // Freeze the dragged stop in place at its index so React keys stay
      // stable even when positions cross another stop.
      const next = initialStops.map((s, i) =>
        i === idx ? { ...s, position: formatPercent(pct) } : s
      )
      setDraftStops(next)
      setStopPosition(idx, pct, { partial: true })
    },
    [setDraftStops, setStopPosition]
  )

  const onPinPointerUp = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current
      if (!drag) return
      try {
        e.currentTarget.releasePointerCapture(drag.pointerId)
      } catch {
        // Pointer may already have been released by the browser.
      }
      if (drag.moved) {
        // Final, non-partial commit so positions sort and history settles.
        setStopPosition(drag.idx, drag.lastPct)
      }
      dragRef.current = null
      setDraftStops(null)
    },
    [setDraftStops, setStopPosition]
  )

  const onBarPointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Ignore clicks that originated on a pin — those go through pointerup.
      if ((e.target as HTMLElement).closest("[data-slot=gradient-pin]")) return
      const bar = barRef.current
      if (!bar) return
      const rect = bar.getBoundingClientRect()
      const pct = clamp(((e.clientX - rect.left) / rect.width) * 100, 0, 100)
      addStop(pct)
    },
    [addStop]
  )

  const onPinKeyDown = React.useCallback(
    (idx: number, e: React.KeyboardEvent<HTMLButtonElement>) => {
      const cur = stopPercent(parsed.stops[idx]?.position ?? "0%")
      const step = e.shiftKey ? 10 : 1
      let next: number | null = null
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowDown":
          next = cur - step
          break
        case "ArrowRight":
        case "ArrowUp":
          next = cur + step
          break
        case "Home":
          next = 0
          break
        case "End":
          next = 100
          break
      }
      if (next === null) return
      e.preventDefault()
      setStopPosition(idx, next)
    },
    [parsed.stops, setStopPosition]
  )

  const stops = effectiveStops
  const gradientCss = `linear-gradient(to right, ${stops
    .map((s) => `${s.color} ${s.position}`)
    .join(", ")})`

  return (
    <div
      data-slot="gradient-picker-track"
      className={cn("relative pt-6 pb-1", className)}
    >
      <div
        ref={barRef}
        onPointerDown={onBarPointerDown}
        className="relative h-3 w-full cursor-copy rounded-full border border-input shadow-inner"
        style={{
          backgroundImage: `${gradientCss}, ${CHECKERBOARD}`,
        }}
      >
        {stops.map((stop, idx) => {
          const pct = stopPercent(stop.position)
          const selected = idx === selectedIdx
          return (
            <button
              key={idx}
              type="button"
              data-slot="gradient-pin"
              data-selected={selected || undefined}
              aria-label={`Stop ${idx + 1}`}
              role="slider"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              tabIndex={0}
              onPointerDown={(e) => onPinPointerDown(idx, e)}
              onPointerMove={onPinPointerMove}
              onPointerUp={onPinPointerUp}
              onPointerCancel={onPinPointerUp}
              onKeyDown={(e) => onPinKeyDown(idx, e)}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-[calc(100%+2px)] cursor-grab outline-none focus-visible:ring-3 focus-visible:ring-ring/30 active:cursor-grabbing"
              )}
              style={{ left: `${pct}%` }}
            >
              <span
                aria-hidden
                className={cn(
                  "block size-4 rounded-t-full rounded-b-[2px] border-2 border-background ring-1 ring-foreground/40 shadow-sm transition-transform",
                  selected && "scale-110 ring-2 ring-ring"
                )}
                style={{ backgroundColor: stop.color }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------- flip ----------

export function GradientPickerFlip({ className }: { className?: string }) {
  const { flipStops } = useGradientPicker()
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={flipStops}
      data-slot="gradient-picker-flip"
      className={cn(
        "h-8 w-full justify-between px-2 text-xs text-foreground",
        className
      )}
    >
      <span>Flip</span>
      <ArrowLeftRight className="size-3.5" aria-hidden />
    </Button>
  )
}

// ---------- inline panel ----------

export function GradientPickerFields({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="gradient-picker-fields"
      className={cn("grid grid-cols-2 gap-3", className)}
    >
      {children}
    </div>
  )
}

// ---------- color field ----------

export function GradientPickerColor({ className }: { className?: string }) {
  const { parsed, selectedIdx, setStopColor, removeStop } = useGradientPicker()
  const stop = parsed.stops[selectedIdx]
  const color = stop?.color ?? "#000000"
  const canDelete = parsed.stops.length > MIN_STOPS

  const [draft, setDraft] = React.useState(color)
  const [lastSeen, setLastSeen] = React.useState(color)
  if (color !== lastSeen) {
    setLastSeen(color)
    setDraft(color)
  }

  const commitDraft = () => {
    const next = draft.trim()
    if (!next || !colord(next).isValid()) {
      setDraft(color)
      return
    }
    if (next === color) return
    setStopColor(selectedIdx, next)
  }

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-color"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Color</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                aria-label="Edit color"
                className="size-8 shrink-0 rounded-md border border-input shadow-xs"
                style={{
                  backgroundColor: color,
                  backgroundImage: CHECKERBOARD,
                  backgroundBlendMode: "normal",
                }}
              />
            }
          />
          <PopoverContent
            align="start"
            sideOffset={8}
            className="w-64 gap-3 p-3"
          >
            <ColorPicker
              value={color}
              onChange={(next, opts) => setStopColor(selectedIdx, next, opts)}
            >
              <ColorPickerCanvas />
              <ColorPickerSwatches />
              <ColorPickerChannels />
            </ColorPicker>
          </PopoverContent>
        </Popover>
        <Input
          inputSize="sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            else if (e.key === "Escape") {
              setDraft(color)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 text-xs"
          aria-label="Color value"
        />
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Delete stop"
            onClick={() => removeStop(selectedIdx)}
            className="text-muted-foreground"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </Button>
        )}
      </div>
    </Field>
  )
}

// ---------- stop percent field ----------

export function GradientPickerStop({ className }: { className?: string }) {
  const { parsed, selectedIdx, setStopPosition } = useGradientPicker()
  const stop = parsed.stops[selectedIdx]
  const pct = stop ? Math.round(stopPercent(stop.position)) : 0

  const [draft, setDraft] = React.useState(String(pct))
  const [lastSeen, setLastSeen] = React.useState(pct)
  if (pct !== lastSeen) {
    setLastSeen(pct)
    setDraft(String(pct))
  }

  const commitDraft = () => {
    const n = Number(draft.trim())
    if (!Number.isFinite(n)) {
      setDraft(String(pct))
      return
    }
    const clamped = clamp(n, 0, 100)
    if (clamped === pct) {
      setDraft(String(clamped))
      return
    }
    setStopPosition(selectedIdx, clamped)
  }

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-stop"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Stop</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputSize="sm"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            else if (e.key === "Escape") {
              setDraft(String(pct))
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 text-xs tabular-nums"
          aria-label="Stop position percentage"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </Field>
  )
}

// ---------- type field ----------

export function GradientPickerType({ className }: { className?: string }) {
  const { parsed, setBaseType, setRepeating } = useGradientPicker()
  const base = baseTypeOf(parsed.type)
  const repeating = isRepeating(parsed.type)

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-type"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Type</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Select
          value={base}
          onValueChange={(v) => setBaseType(v as "linear" | "radial")}
        >
          <SelectTrigger size="sm" className="flex-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="linear">Linear</SelectItem>
            <SelectItem value="radial">Radial</SelectItem>
          </SelectContent>
        </Select>
        <label
          className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground select-none"
          title="Repeating gradient"
        >
          <Checkbox
            size="sm"
            checked={repeating}
            onCheckedChange={(v) => setRepeating(v === true)}
            aria-label="Repeating"
          />
          <span>Repeat</span>
        </label>
      </div>
    </Field>
  )
}

// ---------- angle / position field ----------

export function GradientPickerAngle({ className }: { className?: string }) {
  const { parsed, setDirection } = useGradientPicker()
  const isLinear = baseTypeOf(parsed.type) === "linear"

  if (isLinear) {
    return (
      <AngleInputField
        className={className}
        direction={parsed.direction}
        onChange={setDirection}
      />
    )
  }

  const current = radialPositionFromDirection(parsed.direction)
  const labelFor = (p: RadialPosition) =>
    p.replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-angle"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Position</FieldLabel>
      <Select
        value={current}
        onValueChange={(v) =>
          setDirection(radialPositionToDirection(v as RadialPosition))
        }
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RADIAL_POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {labelFor(p)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

function AngleInputField({
  direction,
  onChange,
  className,
}: {
  direction: string
  onChange: (next: string) => void
  className?: string
}) {
  const deg = directionToDegrees(direction) ?? 90
  const rounded = Math.round(deg)

  const [draft, setDraft] = React.useState(String(rounded))
  const [lastSeen, setLastSeen] = React.useState(rounded)
  if (rounded !== lastSeen) {
    setLastSeen(rounded)
    setDraft(String(rounded))
  }

  const commitDraft = () => {
    const n = Number(draft.trim())
    if (!Number.isFinite(n)) {
      setDraft(String(rounded))
      return
    }
    onChange(degreesToDirection(n))
  }

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-angle"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Angle</FieldLabel>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          inputSize="sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            else if (e.key === "Escape") {
              setDraft(String(rounded))
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 text-xs tabular-nums"
          aria-label="Gradient angle in degrees"
        />
        <span className="text-xs text-muted-foreground">deg</span>
      </div>
    </Field>
  )
}
