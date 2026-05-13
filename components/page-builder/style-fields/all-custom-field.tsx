"use client"

import * as React from "react"
import type { Property, PropertyComposite } from "grapesjs"
import { RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { AllCustomToggle, type ToggleMode } from "./all-custom-toggle"
import { NumberInput } from "./number-field"
import NumberField from "./number-field"
import type { TokenCategory } from "./open-props-tokens"

type AllCustomContextValue = {
  mode: ToggleMode
  setMode: (mode: ToggleMode) => void
  propagate: (value: string, opts?: { partial?: boolean }) => void
  allMatch: boolean
  value: string
  name: string
  propertyId: string
}

const AllCustomCtx = React.createContext<AllCustomContextValue | null>(null)

function useAllCustom(): AllCustomContextValue {
  const ctx = React.useContext(AllCustomCtx)
  if (!ctx)
    throw new Error(
      "AllCustomField* components must be used within <AllCustomField>"
    )
  return ctx
}

const valueKey = (p: Property): string => p.getValue() ?? ""

function detectMode(subs: Property[]): ToggleMode {
  if (subs.length === 0) return "all"
  const first = valueKey(subs[0])
  return subs.every((s) => valueKey(s) === first) ? "all" : "custom"
}

export function AllCustomField({
  property,
  children,
}: {
  property: PropertyComposite
  children: React.ReactNode
}) {
  const subs = property.getProperties() as Property[]
  const name = property.getName()

  const propertyId = property.getId()
  const [mode, setMode] = React.useState<ToggleMode>(() => detectMode(subs))
  const [trackedId, setTrackedId] = React.useState(propertyId)
  if (trackedId !== propertyId) {
    setTrackedId(propertyId)
    setMode(detectMode(subs))
  }

  const first = subs[0]
  const allMatch =
    subs.length > 0 &&
    subs.every((s) => valueKey(s) === valueKey(subs[0]))
  const value =
    allMatch && first?.getValue() != null ? String(first.getValue()) : ""

  const propagate = (
    raw: string,
    opts: { partial?: boolean } = {}
  ): void => {
    const trimmed = raw.trim()
    for (const s of subs) s.upValue(trimmed, opts)
  }

  const handleSetMode = (next: ToggleMode): void => {
    if (next === mode) return
    if (next === "all" && first) {
      const current = first.getValue()
      propagate(current == null ? "" : String(current))
    }
    setMode(next)
  }

  const ctx: AllCustomContextValue = {
    mode,
    setMode: handleSetMode,
    propagate,
    allMatch,
    value,
    name,
    propertyId,
  }

  return (
    <AllCustomCtx.Provider value={ctx}>
      <div className="rounded-md border border-border/60 bg-muted/30 p-2 space-y-2">
        {children}
      </div>
    </AllCustomCtx.Provider>
  )
}

export function AllCustomFieldControl({
  varCategories,
  allTooltip = "Apply one value to all",
  customTooltip = "Edit each independently",
  ariaLabelSuffix = "all",
}: {
  varCategories?: TokenCategory[]
  allTooltip?: string
  customTooltip?: string
  ariaLabelSuffix?: string
}) {
  const { value, allMatch, name, propagate, mode, setMode, propertyId } =
    useAllCustom()

  return (
    <div className="flex gap-2 items-center">
      <NumberInput
        key={propertyId}
        value={value}
        placeholder={allMatch ? "0" : "Custom"}
        ariaLabel={`${name} ${ariaLabelSuffix}`}
        varCategories={varCategories}
        onCommit={propagate}
      />
      <AllCustomToggle
        mode={mode}
        onChange={setMode}
        ariaLabel={`${name} mode`}
        allTooltip={allTooltip}
        customTooltip={customTooltip}
      />
    </div>
  )
}

export function AllCustomFieldContent({
  children,
}: {
  children: React.ReactNode
}) {
  const { mode } = useAllCustom()
  if (mode !== "custom") return null
  return <>{children}</>
}

export function AllCustomFieldItem({
  sub,
  label,
  className,
}: {
  sub: Property
  label: string
  className?: string
}) {
  const canClear = sub.canClear()
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-center gap-1 px-0.5">
        <span className="text-center text-xs text-muted-foreground">
          {label}
        </span>
        {canClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-4 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label}`}
            onClick={() => sub.clear()}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <NumberField property={sub} slider={false} />
    </div>
  )
}
