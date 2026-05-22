"use client"

import * as React from "react"
import { ArrowLeftRight, X } from "lucide-react"
import { colord } from "colord"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
} from "@/components/ui/color-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
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
  DEFAULT_GRADIENT,
  GRADIENT_TYPES,
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

const TYPE_LABELS: Record<GradientType, string> = {
  linear: "Linear",
  radial: "Radial",
  "repeating-linear": "Repeating Linear",
  "repeating-radial": "Repeating Radial",
}

const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase())

const RADIAL_POSITION_LABELS = Object.fromEntries(
  RADIAL_POSITIONS.map((p) => [p, titleCase(p)])
) as Record<RadialPosition, string>

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
  setType: (next: GradientType) => void
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
      const next = parsed.stops.map((s, i) => (i === idx ? { ...s, color } : s))
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

  const setType = React.useCallback(
    (next: GradientType) => {
      if (next === parsed.type) return
      const dir = coerceDirection(parsed.type, next, parsed.direction)
      commit(next, dir, parsed.stops)
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
    setType,
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
    removeStop,
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
      if (e.key === "Delete" || e.key === "Backspace") {
        if (parsed.stops.length <= MIN_STOPS) return
        e.preventDefault()
        removeStop(idx)
        return
      }
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
    [parsed.stops, removeStop, setStopPosition]
  )

  const stops = effectiveStops
  const gradientCss = `linear-gradient(to right, ${stops
    .map((s) => `${s.color} ${s.position}`)
    .join(", ")})`

  return (
    <div
      data-slot="gradient-picker-track"
      className={cn("relative pt-7", className)}
    >
      <div
        ref={barRef}
        onPointerDown={onBarPointerDown}
        className="relative h-4 w-full cursor-copy rounded-full shadow-inner"
        style={{
          backgroundImage: `${gradientCss}, ${CHECKERBOARD}`,
        }}
      >
        {stops.map((stop, idx) => {
          const pct = stopPercent(stop.position)
          const selected = idx === selectedIdx
          const canDelete = parsed.stops.length > MIN_STOPS
          return (
            <div
              key={idx}
              className="group/pin absolute top-1/2 size-5 -translate-x-1/2 -translate-y-[calc(100%+16px)]"
              style={{ left: `${pct}%` }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
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
                  // Pin-specific overrides on top of the Button primitive:
                  // shrink to the bubble's size, drop padding, neutralize the
                  // hover bg and active translate (which would fight drag).
                  "size-5 cursor-grab rounded-md p-0 hover:bg-transparent active:translate-y-0 active:cursor-grabbing dark:hover:bg-transparent",
                  // Downward pointer that turns the bubble into a marker
                  // shape aimed at the track below.
                  "before:absolute before:top-full before:left-1/2 before:-translate-x-1/2",
                  "before:size-0 before:border-x-4 before:border-t-8 before:border-x-transparent before:border-t-foreground/40 before:content-['']"
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative block size-4 rounded-md border-2 border-background shadow-sm ring-1 ring-foreground/40 transition-transform",
                    selected && "scale-110 ring-2 ring-ring"
                  )}
                  style={{ backgroundColor: stop.color }}
                />
              </Button>
              {canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-xs"
                  aria-label={`Remove stop ${idx + 1}`}
                  // Stop the pointerdown from reaching the pin button below
                  // (which would otherwise start a drag).
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    removeStop(idx)
                  }}
                  className="absolute -top-2 -right-2 z-10 size-5 rounded-full p-0 opacity-0 transition-opacity group-focus-within/pin:opacity-100 group-hover/pin:opacity-100"
                >
                  <X className="size-2.5" aria-hidden />
                </Button>
              )}
            </div>
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
  const { parsed, selectedIdx, setStopColor } = useGradientPicker()
  const stop = parsed.stops[selectedIdx]
  const color = stop?.color ?? "#000000"

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
                className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-input bg-white shadow-xs"
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
          type="text"
          value={draft}
          placeholder={color}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            else if (e.key === "Escape") {
              setDraft(color)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className="flex-1 bg-transparent text-xs"
          spellCheck={false}
          autoComplete="off"
          aria-label="Color value"
        />
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
      <InputGroup className="h-8">
        <InputGroupInput
          type="number"
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
          className="text-xs tabular-nums"
          aria-label="Stop position percentage"
        />
        <InputGroupAddon align="inline-end" className="text-xs">
          %
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}

// ---------- type field ----------

export function GradientPickerType({ className }: { className?: string }) {
  const { parsed, setType } = useGradientPicker()

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-type"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">Type</FieldLabel>
      <Select
        items={TYPE_LABELS}
        value={parsed.type}
        onValueChange={(v) => {
          if (v) setType(v as GradientType)
        }}
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          {GRADIENT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>
              {TYPE_LABELS[t]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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

  return (
    <Field
      orientation="vertical"
      data-slot="gradient-picker-angle"
      className={className}
    >
      <FieldLabel className="text-xs text-muted-foreground">
        Position
      </FieldLabel>
      <Select
        items={RADIAL_POSITION_LABELS}
        value={current}
        onValueChange={(v) => {
          if (v) setDirection(radialPositionToDirection(v as RadialPosition))
        }}
      >
        <SelectTrigger size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="p-1">
          {RADIAL_POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {RADIAL_POSITION_LABELS[p]}
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
      <InputGroup className="h-8">
        <InputGroupInput
          type="number"
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
          className="text-xs tabular-nums"
          aria-label="Gradient angle in degrees"
        />
        <InputGroupAddon align="inline-end" className="text-xs">
          deg
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
}
