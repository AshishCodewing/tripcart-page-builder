"use client"

import type { Property } from "grapesjs"

import { AllCustomFieldItem } from "./all-custom-field"

export type Side = "top" | "right" | "bottom" | "left"

const SIDES: Side[] = ["top", "right", "bottom", "left"]

const POSITION: Record<Side, string> = {
  top: "col-start-2 row-start-1 col-end-6",
  left: "col-start-1 row-start-2 col-end-4",
  right: "col-start-4 row-start-2 col-end-7",
  bottom: "col-start-2 row-start-3 col-end-6",
}

export function CrossGrid({
  bySide,
}: {
  bySide: (side: Side) => Property | undefined
}) {
  return (
    <div className="grid grid-cols-6 grid-rows-3 gap-4">
      {SIDES.map((side) => {
        const sub = bySide(side)
        if (!sub) return null
        return (
          <AllCustomFieldItem
            key={side}
            sub={sub}
            label={side.charAt(0).toUpperCase() + side.slice(1)}
            className={POSITION[side]}
          />
        )
      })}
    </div>
  )
}
