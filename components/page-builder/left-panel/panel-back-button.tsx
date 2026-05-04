"use client"

import * as React from "react"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { useLeftPanel, type LeftPanelMode } from "./left-panel-context"

export function PanelBackButton({
  to = "theme",
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<typeof Button> & {
  to?: LeftPanelMode
}) {
  const { togglePanel } = useLeftPanel()

  return (
    <Button
      data-slot="panel-back-button"
      variant="link"
      size="sm"
      className="flex w-full items-center justify-start ps-0 pe-2 text-foreground"
      onClick={(event) => {
        onClick?.(event)
        togglePanel(to)
      }}
      {...props}
    >
      <ChevronLeft />
      {children}
    </Button>
  )
}
