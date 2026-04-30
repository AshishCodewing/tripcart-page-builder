"use client"

import * as React from "react"
import { ChevronLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import { SidebarContent } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"

import { useLeftPanel, type LeftPanelMode } from "./left-panel-context"

function SubPanel({
  className,
  ...props
}: React.ComponentProps<typeof SidebarContent>) {
  return (
    <SidebarContent
      data-slot="sub-panel"
      className={cn("p-2", className)}
      {...props}
    />
  )
}

function SubPanelBack({
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
      data-slot="sub-panel-back"
      variant="link"
      size="sm"
      className={cn(
        "flex w-full items-center justify-start ps-0 pe-2",
        className
      )}
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

function SubPanelDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="sub-panel-description"
      className={cn("my-2 px-2 text-xs text-balance", className)}
      {...props}
    />
  )
}

function SubPanelSection({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sub-panel-section"
      className={cn("space-y-2 border-t px-2 py-2", className)}
      {...props}
    />
  )
}

export { SubPanel, SubPanelBack, SubPanelDescription, SubPanelSection }
