import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"

function SliderInput({
  className,
  defaultValue,
  value: controlledValue,
  onValueChange,
  min = 0,
  max = 100,
}: {
  className?: string
  defaultValue?: readonly number[]
  value?: readonly number[]
  onValueChange?: (value: readonly number[]) => void
  min?: number
  max?: number
}) {
  const initial = controlledValue ?? defaultValue ?? [min, max]
  const [values, setValues] = React.useState<readonly number[]>(initial)

  const isControlled = controlledValue !== undefined
  const currentValues = isControlled ? controlledValue : values

  function handleSliderChange(v: number | readonly number[]) {
    const arr = Array.isArray(v) ? v : [v]
    if (!isControlled) setValues(arr)
    onValueChange?.(arr)
  }

  function handleInputChange(index: number, raw: string) {
    const num = Number(raw)
    if (Number.isNaN(num)) return
    const clamped = Math.min(max, Math.max(min, num))
    const next = [...currentValues]
    next[index] = clamped
    if (!isControlled) setValues(next)
    onValueChange?.(next)
  }

  return (
    <div
      data-slot="slider-input"
      className={cn("flex w-full items-center gap-2", className)}
    >
      <Input
        type="number"
        value={currentValues[0]}
        onChange={(e) => handleInputChange(0, e.target.value)}
        min={min}
        max={max}
        className="no-spinner h-8 w-16 px-2 text-center text-xs font-medium tabular-nums shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]"
      />
      <Slider
        value={[...currentValues]}
        onValueChange={handleSliderChange}
        min={min}
        max={max}
        className="min-w-0 flex-1"
      />
      {currentValues.length > 1 && (
        <Input
          type="number"
          value={currentValues[currentValues.length - 1]}
          onChange={(e) =>
            handleInputChange(currentValues.length - 1, e.target.value)
          }
          min={min}
          max={max}
          className="no-spinner h-8 w-16 px-2 text-center text-xs font-medium tabular-nums shadow-[0_12px_16px_-4px_rgba(16,24,40,0.08),0_4px_6px_-2px_rgba(16,24,40,0.03)]"
        />
      )}
    </div>
  )
}

export { SliderInput }
