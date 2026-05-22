"use client"

import * as React from "react"
import { HexAlphaColorPicker } from "react-colorful"
import { colord, type Colord, type HslaColor, type RgbaColor } from "colord"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Tabs,
  TabsContent,
  TabsIndicator,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useThemeSelector } from "@/hooks/use-theme"
import { Button } from "./button"

// ---------- types ----------

export type TokenSwatch =
  | { kind: "token"; token: string; hex: string; label?: string }
  | { kind: "hex"; hex: string; label?: string }

type ColorMode = "hex" | "rgb" | "hsl"

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
    throw new Error(
      "ColorPicker subcomponents must be used inside <ColorPicker>"
    )
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
        className={cn(
          "custom-picker-wrapper flex w-full flex-col gap-3",
          className
        )}
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
  const { swatches, valueRaw, color, commitColord, commitRaw } =
    useColorPicker()

  if (!swatches.length) return null

  const currentHex = color?.toHex().toLowerCase()

  return (
    <TooltipProvider delay={300}>
      <div
        data-slot="color-picker-swatches"
        className={cn("grid grid-cols-8 gap-1", className)}
      >
        {swatches.map((s, i) => {
          const isToken = s.kind === "token"
          const isSelected = isToken
            ? valueRaw === `var(${s.token})`
            : currentHex === s.hex.toLowerCase()
          const key = isToken ? s.token : `${s.hex}-${i}`
          return (
            <Tooltip key={key}>
              <TooltipTrigger
                render={
                  <Button
                    size="sm"
                    type="button"
                    data-slot="color-picker-swatch"
                    aria-label={s.label ?? (isToken ? s.token : s.hex)}
                    onClick={() => {
                      if (isToken) {
                        commitRaw(`var(${s.token})`)
                      } else {
                        commitColord(colord(s.hex))
                      }
                    }}
                    className={cn(
                      "relative flex aspect-square h-auto w-full rounded-md border border-border/60 shadow-xs transition-[transform,box-shadow] hover:scale-105",
                      isSelected &&
                        "ring-2 ring-ring/70 ring-offset-1 ring-offset-popover"
                    )}
                    style={{ backgroundColor: s.hex }}
                  />
                }
              />
              <TooltipContent>
                {s.label ?? (isToken ? s.token : s.hex)}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
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
      className="no-spinner h-7 px-2 text-xs uppercase tabular-nums"
    />
  )
}

// Fallback used when upstream value isn't a parseable color (`var(--x)`, empty).
// Channels stay enabled, and typing into them commits opaque black + the change.
const FALLBACK_COLOR = colord("#000000")

// Alpha as 0–100 percentage (UI-friendlier than 0–1).
function AlphaChannelInput() {
  const { color, commitColord } = useColorPicker()
  const alphaPct = color ? Math.round(color.alpha() * 100) : ""
  return (
    <ChannelInput
      value={String(alphaPct)}
      min={0}
      max={100}
      onCommit={(raw) => {
        const n = numOrEmpty(raw)
        if (n === null) return
        const base = color ?? FALLBACK_COLOR
        commitColord(base.alpha(clamp(n, 0, 100) / 100))
      }}
      ariaLabel="Alpha"
    />
  )
}

// ---------- channels block ----------

function ColorPickerChannels({ className }: { className?: string }) {
  const { color, mode, setMode, commitColord } = useColorPicker()

  return (
    <Tabs
      value={mode}
      onValueChange={(next) => setMode(next as ColorMode)}
      data-slot="color-picker-channels"
      className={cn("gap-2", className)}
    >
      <TabsList className="w-full justify-between">
        <TabsIndicator />
        <TabsTrigger value="hex" className="py-1 text-xs">
          Hex
        </TabsTrigger>
        <TabsTrigger value="rgb" className="py-1 text-xs">
          RGB
        </TabsTrigger>
        <TabsTrigger value="hsl" className="py-1 text-xs">
          HSL
        </TabsTrigger>
      </TabsList>

      <TabsContent value="hex">
        <div className="grid grid-cols-[1fr_4rem] gap-1.5">
          <HexChannelInput
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
        <SpaceChannels space={RGB_SPACE} />
      </TabsContent>

      <TabsContent value="hsl">
        <SpaceChannels space={HSL_SPACE} />
      </TabsContent>
    </Tabs>
  )
}

function ChannelLabels({ labels, cols }: { labels: string[]; cols: string }) {
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

// Config-driven channel block for the RGB / HSL tabs. The spaces differ only
// in which colord object shape they read/write and the per-channel metadata
// (range, label, normalization), so we encode those as data and share one
// render path.

type ChannelSpec = {
  key: string
  min: number
  max: number
  ariaLabel: string
  label: string
  normalize: (n: number) => number
}

type ColorSpace = {
  toSpace: (c: Colord) => Record<string, number>
  apply: (c: Colord, key: string, value: number) => Colord
  channels: ChannelSpec[]
}

const clampTo = (min: number, max: number) => (n: number) => clamp(n, min, max)
const wrapHue = (n: number) => ((n % 360) + 360) % 360

const RGB_SPACE: ColorSpace = {
  toSpace: (c) => c.toRgb(),
  apply: (c, key, value) => colord({ ...c.toRgb(), [key]: value } as RgbaColor),
  channels: [
    {
      key: "r",
      min: 0,
      max: 255,
      ariaLabel: "Red",
      label: "R",
      normalize: clampTo(0, 255),
    },
    {
      key: "g",
      min: 0,
      max: 255,
      ariaLabel: "Green",
      label: "G",
      normalize: clampTo(0, 255),
    },
    {
      key: "b",
      min: 0,
      max: 255,
      ariaLabel: "Blue",
      label: "B",
      normalize: clampTo(0, 255),
    },
  ],
}

const HSL_SPACE: ColorSpace = {
  toSpace: (c) => c.toHsl(),
  apply: (c, key, value) => colord({ ...c.toHsl(), [key]: value } as HslaColor),
  channels: [
    {
      key: "h",
      min: 0,
      max: 360,
      ariaLabel: "Hue",
      label: "H",
      normalize: wrapHue,
    },
    {
      key: "s",
      min: 0,
      max: 100,
      ariaLabel: "Saturation",
      label: "S",
      normalize: clampTo(0, 100),
    },
    {
      key: "l",
      min: 0,
      max: 100,
      ariaLabel: "Lightness",
      label: "L",
      normalize: clampTo(0, 100),
    },
  ],
}

function SpaceChannels({ space }: { space: ColorSpace }) {
  const { color, commitColord } = useColorPicker()
  const current = color ? space.toSpace(color) : null

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {space.channels.map((ch) => (
          <ChannelInput
            key={ch.key}
            value={current ? String(Math.round(current[ch.key])) : ""}
            min={ch.min}
            max={ch.max}
            ariaLabel={ch.ariaLabel}
            onCommit={(raw) => {
              const n = numOrEmpty(raw)
              if (n === null) return
              commitColord(
                space.apply(color ?? FALLBACK_COLOR, ch.key, ch.normalize(n))
              )
            }}
          />
        ))}
        <AlphaChannelInput />
      </div>
      <ChannelLabels
        labels={[...space.channels.map((ch) => ch.label), "A"]}
        cols="repeat(4,1fr)"
      />
    </>
  )
}

export {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
}
