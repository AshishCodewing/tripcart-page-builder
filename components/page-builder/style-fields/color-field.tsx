"use client"

import type { Property } from "grapesjs"

import { Input } from "@/components/ui/input"

const CHECKER_BG: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
  backgroundSize: "8px 8px",
  backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
}

const HEX_RE = /^#[0-9a-f]{6}$/i
const HEX_ANY_RE = /^#[0-9a-f]{3,8}$/i

export default function ColorField({ property }: { property: Property }) {
  const value = String(property.getValue() ?? "")
  // Native <input type="color"> only accepts #rrggbb. If the value is a
  // var(...) / rgba(...) / etc., we still surface it via the text input;
  // the swatch falls back to a checker pattern.
  const hex = HEX_RE.test(value) ? value : "#000000"
  const showSwatchColor = HEX_ANY_RE.test(value)

  return (
    <div className="flex w-full items-center gap-1.5">
      <label
        className="relative inline-flex size-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-input shadow-xs"
        aria-label="Pick color"
        style={showSwatchColor ? { backgroundColor: value } : CHECKER_BG}
      >
        <input
          type="color"
          value={hex}
          onChange={(e) => property.upValue(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <Input
        inputSize="sm"
        type="text"
        value={value}
        onChange={(e) => property.upValue(e.target.value)}
        placeholder={property.getDefaultValue() || ""}
        className="min-w-0 flex-1"
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  )
}
