"use client"

import * as React from "react"
import type { Property, PropertyStack } from "grapesjs"
import { Plus, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

type PropertyRowProps = {
  property: Property
  layout: "inline" | "block"
  children: React.ReactNode
}

export default function PropertyRow({
  property,
  layout,
  children,
}: PropertyRowProps) {
  const inherited = property.hasValueParent()
  const canClear = property.canClear()
  const label = property.getLabel()?.trim() ?? ""

  return (
    <div
      data-inherited={inherited || undefined}
      className={cn(
        "flex gap-1",
        layout === "inline"
          ? "items-center justify-between"
          : "flex-col items-stretch"
      )}
    >
      <div className="flex items-center gap-1.5">
        {label ? (
          <span
            className={cn(
              "min-w-0 flex-1 truncate py-1 text-xs text-muted-foreground",
              inherited ? "flex items-center gap-2" : ""
            )}
          >
            {label}
            {inherited && (
              <span className="size-1.5 shrink-0 rounded-full bg-warning" />
            )}
          </span>
        ) : null}
        {canClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={`Clear ${label}`}
            onClick={() => property.clear()}
          >
            <RotateCcw className="size-3" aria-hidden="true" />
          </Button>
        ) : null}
        {property.getType() === "stack" ? (
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                onClick={() =>
                  (property as PropertyStack).addLayer({}, { at: 0 })
                }
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add {label.toLowerCase()} layer</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div
        className={cn(
          layout === "inline"
            ? "flex max-w-[60%] min-w-0 flex-1 items-center"
            : ""
        )}
      >
        {children}
      </div>
    </div>
  )
}
