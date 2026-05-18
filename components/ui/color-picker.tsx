"use client"

import * as React from "react"
import { HexAlphaColorPicker } from "react-colorful"
import { colord, type Colord } from "colord"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useThemeSelector } from "@/hooks/use-theme"

// ---------- types ----------

export type TokenSwatch =
  | { kind: "token"; token: string; hex: string; label?: string }
  | { kind: "hex"; hex: string; label?: string }

type ColorMode = "hex" | "rgb" | "hsl" | "hsb"

type CommitOpts = { partial?: boolean }

type ColorPickerContextValue = {
  /** Raw upstream value (may be `var(--x)`, hex, rgba(), etc.). */
  valueRaw: string
  /** Parsed canonical color, or null when `valueRaw` isn't a recognized color. */
  color: Colord | null
  /** Active channel-tab mode. */
  mode: ColorMode
  setMode: (next: ColorMode) => void
  /** Commit a new color (typed from channels / canvas). Serializes to hex. */
  commitColord: (next: Colord, opts?: CommitOpts) => void
  /** Commit a raw CSS value (used by token swatches → `var(--x)`). */
  commitRaw: (next: string, opts?: CommitOpts) => void
  /** Marks a drag-in-progress so consumers can emit partial commits. */
  setDragging: (next: boolean) => void
  swatches: TokenSwatch[]
}

const ColorPickerContext = React.createContext<ColorPickerContextValue | null>(
  null
)

const useColorPicker = () => {
  const ctx = React.useContext(ColorPickerContext)
  if (!ctx) {
    throw new Error("ColorPicker subcomponents must be used inside <ColorPicker>")
  }
  return ctx
}

// ---------- helpers ----------

// Default swatch list: every theme color token, resolved to its live hex
// via the theme store (so editing the theme updates the picker).
function useDefaultThemeSwatches(): TokenSwatch[] {
  const themeColors = useThemeSelector((s) => s.theme.colors)
  return React.useMemo(() => {
    const out: TokenSwatch[] = []
    for (const [camelKey, slot] of Object.entries(themeColors)) {
      const live = (slot as { value?: string } | undefined)?.value
      if (!live) continue
      // camelKey -> kebab token name (without `--theme-` prefix here, we add it).
      const kebab = camelKey.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
      out.push({
        kind: "token",
        token: `--theme-${kebab}`,
        hex: live,
        label: kebab,
      })
    }
    return out
  }, [themeColors])
}

// Serialize a color in the shape matching the active channel mode, so
// upstream values keep their original CSS notation (rgb stays rgb, hsl stays
// hsl, etc.) instead of collapsing to hex on every commit.
const serialize = (c: Colord, mode: ColorMode): string => {
  switch (mode) {
    case "rgb":
      return c.toRgbString()
    case "hsl":
      return c.toHslString()
    // CSS has no hsb/hsv literal — fall back to rgb so the value stays valid.
    case "hsb":
      return c.toRgbString()
    case "hex":
    default:
      return c.toHex()
  }
}

const numOrEmpty = (s: string): number | null => {
  const trimmed = s.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n))

// ---------- root ----------

type ColorPickerProps = {
  value: string
  onChange: (next: string, opts?: CommitOpts) => void
  /** Override the default theme-token swatches. */
  swatches?: TokenSwatch[]
  className?: string
  children: React.ReactNode
}

function ColorPicker({
  value,
  onChange,
  swatches,
  className,
  children,
}: ColorPickerProps) {
  const [mode, setMode] = React.useState<ColorMode>("hex")
  const [, setDragging] = React.useState(false)

  const defaultSwatches = useDefaultThemeSwatches()
  const resolvedSwatches = swatches ?? defaultSwatches

  const color = React.useMemo<Colord | null>(() => {
    if (!value) return null
    // colord parses hex, rgb(a), hsl(a), named colors — `var(--x)` returns invalid.
    const c = colord(value)
    return c.isValid() ? c : null
  }, [value])

  const commitColord = React.useCallback(
    (next: Colord, opts?: CommitOpts) => {
      onChange(serialize(next, mode), opts)
    },
    [onChange, mode]
  )

  const commitRaw = React.useCallback(
    (next: string, opts?: CommitOpts) => {
      onChange(next, opts)
    },
    [onChange]
  )

  const ctx = React.useMemo<ColorPickerContextValue>(
    () => ({
      valueRaw: value,
      color,
      mode,
      setMode,
      commitColord,
      commitRaw,
      setDragging,
      swatches: resolvedSwatches,
    }),
    [value, color, mode, commitColord, commitRaw, resolvedSwatches]
  )

  return (
    <ColorPickerContext.Provider value={ctx}>
      <div
        data-slot="color-picker"
        className={cn("flex w-full flex-col gap-3 custom-picker-wrapper", className)}
      >
        {children}
      </div>
    </ColorPickerContext.Provider>
  )
}

// ---------- canvas ----------

// Fallback color when upstream value isn't parseable (`var(--x)` etc.):
// black, fully transparent — picking still works, channels stay disabled.
const CANVAS_FALLBACK = "#000000ff"

function ColorPickerCanvas({ className }: { className?: string }) {
  const { color, commitColord, setDragging } = useColorPicker()
  const draggingRef = React.useRef(false)
  const latestRef = React.useRef<Colord | null>(color)

  // Final commit on pointer release — registered while a drag is active so
  // the GrapesJS history records one entry per drag, not one per pixel.
  React.useEffect(() => {
    const onUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = false
      setDragging(false)
      if (latestRef.current) commitColord(latestRef.current)
    }
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [commitColord, setDragging])

  const handlePointerDown = () => {
    draggingRef.current = true
    setDragging(true)
  }

  const handleChange = (hex: string) => {
    const c = colord(hex)
    latestRef.current = c
    commitColord(c, { partial: draggingRef.current })
  }

  return (
    <div
      data-slot="color-picker-canvas"
      onPointerDown={handlePointerDown}
      // Visual overrides for react-colorful (saturation/hue/alpha sizing,
      // pointer styling, etc.) live in app/globals.css under
      // [data-slot="color-picker-canvas"] — utility classes here can't beat
      // react-colorful's single-class selectors on specificity.
      className={cn(className)}
    >
      <HexAlphaColorPicker
        color={color ? color.toHex() : CANVAS_FALLBACK}
        onChange={handleChange}
      />
    </div>
  )
}

// ---------- swatches ----------

function ColorPickerSwatches({ className }: { className?: string }) {
  const { swatches, valueRaw, color, commitColord, commitRaw } = useColorPicker()

  if (!swatches.length) return null

  const currentHex = color?.toHex().toLowerCase()

  return (
    <div
      data-slot="color-picker-swatches"
      className={cn("grid grid-cols-9 gap-1", className)}
    >
      {swatches.map((s, i) => {
        const isToken = s.kind === "token"
        const isSelected = isToken
          ? valueRaw === `var(${s.token})`
          : currentHex === s.hex.toLowerCase()
        const key = isToken ? s.token : `${s.hex}-${i}`
        return (
          <button
            key={key}
            type="button"
            data-slot="color-picker-swatch"
            aria-label={s.label ?? (isToken ? s.token : s.hex)}
            title={s.label ?? (isToken ? s.token : s.hex)}
            onClick={() => {
              if (isToken) {
                commitRaw(`var(${s.token})`)
              } else {
                commitColord(colord(s.hex))
              }
            }}
            className={cn(
              "relative aspect-square w-full rounded-md border border-border/60 shadow-xs transition-[transform,box-shadow] hover:scale-105",
              isSelected &&
                "ring-2 ring-ring/70 ring-offset-1 ring-offset-popover"
            )}
            style={{ backgroundColor: s.hex }}
          />
        )
      })}
    </div>
  )
}

// ---------- channel inputs (shared) ----------

function ChannelInput({
  value,
  onCommit,
  disabled,
  min,
  max,
  step = 1,
  ariaLabel,
  className,
}: {
  value: string
  onCommit: (raw: string) => void
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  ariaLabel: string
  className?: string
}) {
  const [draft, setDraft] = React.useState(value)
  const [last, setLast] = React.useState(value)
  if (value !== last) {
    setLast(value)
    setDraft(value)
  }
  return (
    <Input
      data-slot="color-picker-channel-input"
      type="number"
      inputSize="xs"
      disabled={disabled}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      aria-label={ariaLabel}
      className={cn(
        "no-spinner h-7 px-1 text-center text-xs tabular-nums",
        className
      )}
    />
  )
}

function HexChannelInput({
  value,
  onCommit,
  disabled,
}: {
  value: string
  onCommit: (next: string) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = React.useState(value)
  const [last, setLast] = React.useState(value)
  if (value !== last) {
    setLast(value)
    setDraft(value)
  }
  const commit = () => {
    const raw = draft.trim()
    if (!raw) {
      setDraft(value)
      return
    }
    const candidate = raw.startsWith("#") ? raw : `#${raw}`
    const c = colord(candidate)
    // Always hand back hex from the hex input — the parent re-parses with
    // colord and re-serializes via commitColord using the active mode.
    if (c.isValid()) onCommit(c.toHex())
    else setDraft(value)
  }
  return (
    <Input
      data-slot="color-picker-channel-input"
      type="text"
      inputSize="xs"
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === "Escape") {
          setDraft(value)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      spellCheck={false}
      autoComplete="off"
      aria-label="Hex color"
      className="no-spinner h-7 px-2 text-xs tabular-nums uppercase"
    />
  )
}

// Alpha as 0–100 percentage (UI-friendlier than 0–1).
function AlphaChannelInput() {
  const { color, commitColord } = useColorPicker()
  const alphaPct = color ? Math.round(color.alpha() * 100) : ""
  return (
    <ChannelInput
      value={String(alphaPct)}
      disabled={!color}
      min={0}
      max={100}
      onCommit={(raw) => {
        if (!color) return
        const n = numOrEmpty(raw)
        if (n === null) return
        commitColord(color.alpha(clamp(n, 0, 100) / 100))
      }}
      ariaLabel="Alpha"
    />
  )
}

// ---------- channels block ----------

const TAB_TRIGGER =
  "h-6 rounded-[5px] px-2 text-[11px] font-medium tracking-wide uppercase"

function ColorPickerChannels({ className }: { className?: string }) {
  const { color, mode, setMode, commitColord } = useColorPicker()
  const disabled = !color

  return (
    <Tabs
      value={mode}
      onValueChange={(next) => setMode(next as ColorMode)}
      data-slot="color-picker-channels"
      className={cn("gap-2", className)}
    >
      <TabsList className="w-full justify-between">
        <TabsIndicator />
        <TabsTrigger value="hex" className={TAB_TRIGGER}>
          Hex
        </TabsTrigger>
        <TabsTrigger value="rgb" className={TAB_TRIGGER}>
          RGB
        </TabsTrigger>
        <TabsTrigger value="hsl" className={TAB_TRIGGER}>
          HSL
        </TabsTrigger>
        <TabsTrigger value="hsb" className={TAB_TRIGGER}>
          HSB
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hex">
        <div className="grid grid-cols-[1fr_4rem] gap-1.5">
          <HexChannelInput
            disabled={disabled}
            value={color ? color.toHex().replace(/^#/, "").slice(0, 6) : ""}
            onCommit={(next) => {
              // next is already serialized hex
              const c = colord(next)
              if (c.isValid()) {
                // preserve current alpha when typing only 6-digit hex
                const a = color ? color.alpha() : 1
                commitColord(c.alpha(a))
              }
            }}
          />
          <AlphaChannelInput />
        </div>
        <ChannelLabels labels={["Hex", "A"]} cols="1fr_4rem" />
      </TabsContent>

      <TabsContent value="rgb">
        <RgbChannels disabled={disabled} />
        <ChannelLabels labels={["R", "G", "B", "A"]} cols="repeat(4,1fr)" />
      </TabsContent>

      <TabsContent value="hsl">
        <HslChannels disabled={disabled} />
        <ChannelLabels labels={["H", "S", "L", "A"]} cols="repeat(4,1fr)" />
      </TabsContent>

      <TabsContent value="hsb">
        <HsbChannels disabled={disabled} />
        <ChannelLabels labels={["H", "S", "B", "A"]} cols="repeat(4,1fr)" />
      </TabsContent>
    </Tabs>
  )
}

function ChannelLabels({
  labels,
  cols,
}: {
  labels: string[]
  cols: string
}) {
  return (
    <div
      className="mt-1 grid gap-1.5 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
      style={{ gridTemplateColumns: cols.replaceAll("_", " ") }}
    >
      {labels.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  )
}

function RgbChannels({ disabled }: { disabled: boolean }) {
  const { color, commitColord } = useColorPicker()
  const rgb = color?.toRgb()
  const update = (next: { r?: number; g?: number; b?: number }) => {
    if (!color) return
    const { r, g, b, a } = color.rgba
    commitColord(
      colord({
        r: next.r ?? r,
        g: next.g ?? g,
        b: next.b ?? b,
        a,
      })
    )
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <ChannelInput
        value={rgb ? String(rgb.r) : ""}
        disabled={disabled}
        min={0}
        max={255}
        ariaLabel="Red"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ r: clamp(n, 0, 255) })
        }}
      />
      <ChannelInput
        value={rgb ? String(rgb.g) : ""}
        disabled={disabled}
        min={0}
        max={255}
        ariaLabel="Green"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ g: clamp(n, 0, 255) })
        }}
      />
      <ChannelInput
        value={rgb ? String(rgb.b) : ""}
        disabled={disabled}
        min={0}
        max={255}
        ariaLabel="Blue"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ b: clamp(n, 0, 255) })
        }}
      />
      <AlphaChannelInput />
    </div>
  )
}

function HslChannels({ disabled }: { disabled: boolean }) {
  const { color, commitColord } = useColorPicker()
  const hsl = color?.toHsl()
  const update = (next: { h?: number; s?: number; l?: number }) => {
    if (!color) return
    const { h, s, l, a } = color.toHsl()
    commitColord(
      colord({
        h: next.h ?? h,
        s: next.s ?? s,
        l: next.l ?? l,
        a,
      })
    )
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <ChannelInput
        value={hsl ? String(Math.round(hsl.h)) : ""}
        disabled={disabled}
        min={0}
        max={360}
        ariaLabel="Hue"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ h: ((n % 360) + 360) % 360 })
        }}
      />
      <ChannelInput
        value={hsl ? String(Math.round(hsl.s)) : ""}
        disabled={disabled}
        min={0}
        max={100}
        ariaLabel="Saturation"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ s: clamp(n, 0, 100) })
        }}
      />
      <ChannelInput
        value={hsl ? String(Math.round(hsl.l)) : ""}
        disabled={disabled}
        min={0}
        max={100}
        ariaLabel="Lightness"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ l: clamp(n, 0, 100) })
        }}
      />
      <AlphaChannelInput />
    </div>
  )
}

function HsbChannels({ disabled }: { disabled: boolean }) {
  const { color, commitColord } = useColorPicker()
  // HSB === HSV. colord exposes .toHsv() / accepts {h,s,v}.
  const hsv = color?.toHsv()
  const update = (next: { h?: number; s?: number; v?: number }) => {
    if (!color) return
    const { h, s, v, a } = color.toHsv()
    commitColord(
      colord({
        h: next.h ?? h,
        s: next.s ?? s,
        v: next.v ?? v,
        a,
      })
    )
  }
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <ChannelInput
        value={hsv ? String(Math.round(hsv.h)) : ""}
        disabled={disabled}
        min={0}
        max={360}
        ariaLabel="Hue"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ h: ((n % 360) + 360) % 360 })
        }}
      />
      <ChannelInput
        value={hsv ? String(Math.round(hsv.s)) : ""}
        disabled={disabled}
        min={0}
        max={100}
        ariaLabel="Saturation"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ s: clamp(n, 0, 100) })
        }}
      />
      <ChannelInput
        value={hsv ? String(Math.round(hsv.v)) : ""}
        disabled={disabled}
        min={0}
        max={100}
        ariaLabel="Brightness"
        onCommit={(raw) => {
          const n = numOrEmpty(raw)
          if (n !== null) update({ v: clamp(n, 0, 100) })
        }}
      />
      <AlphaChannelInput />
    </div>
  )
}

export {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
}
