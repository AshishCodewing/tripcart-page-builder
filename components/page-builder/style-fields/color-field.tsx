"use client"

import type { Property } from "grapesjs"

import {
  ColorPicker,
  ColorPickerCanvas,
  ColorPickerChannels,
  ColorPickerSwatches,
} from "@/components/ui/color-picker"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import BaseField from "./base-field"

export default function ColorField({ property }: { property: Property }) {
  const defValue = property.getDefaultValue()
  const hasValue = property.hasValue()
  const value = property.getValue()
  const valueWithDef = hasValue ? String(value) : String(defValue ?? "")

  return (
    <div className="flex w-full items-center gap-1.5">
      <Popover>
        <PopoverTrigger
          render={
            <button
              type="button"
              aria-label="Pick color"
              className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-input shadow-xs"
              style={{ backgroundColor: value }}
            />
          }
        />
        <PopoverContent
          align="start"
          sideOffset={6}
          className="w-64 gap-3 p-3"
        >
          <ColorPicker
            value={valueWithDef}
            onChange={(next, opts) => property.upValue(next, opts)}
          >
            <ColorPickerCanvas />
            <ColorPickerSwatches />
            <ColorPickerChannels />
          </ColorPicker>
        </PopoverContent>
      </Popover>

      <BaseField property={property} />
    </div>
  )
}
