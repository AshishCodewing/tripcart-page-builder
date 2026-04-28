"use client"

import * as React from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }
>({
  size: "default",
  variant: "default",
  spacing: 0,
  orientation: "horizontal",
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 0,
  orientation = "horizontal",
  children,
  ...props
}: ToggleGroupPrimitive.Props &
  VariantProps<typeof toggleVariants> & {
    spacing?: number
    orientation?: "horizontal" | "vertical"
  }) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={{ "--gap": spacing } as React.CSSProperties}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] rounded-lg data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-vertical:flex-col data-vertical:items-stretch",
        // pill variant: muted container with inner padding (segmented control)
        "data-[variant=pill]:border data-[variant=pill]:border-border data-[variant=pill]:bg-muted/50 data-[variant=pill]:p-1",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      data-spacing={context.spacing}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        // Figma: pressed/selected state uses primary colors
        "font-bold aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary/90 aria-pressed:border-primary",
        // Spacing=0: flush items with no gap
        "shrink-0 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pe-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:ps-1.5",
        // First/last corner rounding (horizontal + vertical)
        "group-data-horizontal/toggle-group:data-[spacing=0]:first:rounded-s-lg group-data-horizontal/toggle-group:data-[spacing=0]:last:rounded-e-lg group-data-vertical/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-vertical/toggle-group:data-[spacing=0]:last:rounded-b-lg",
        // Border collapse for outline variant
        "group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:border-s-0 group-data-horizontal/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-s group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-vertical/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        // Pill variant item: override spacing=0 rounding, adjust typography + paddings.
        // The active segment has no bg/border/shadow of its own — the ::before indicator
        // (globals.css, @supports anchor-name) is the sole visual for the selected state.
        // Hover keeps bg transparent and only darkens text (muted-foreground → foreground).
        "group-data-[variant=pill]/toggle-group:rounded-md! group-data-[variant=pill]/toggle-group:px-4 group-data-[variant=pill]/toggle-group:py-1.5 group-data-[variant=pill]/toggle-group:gap-1.5 group-data-[variant=pill]/toggle-group:font-medium group-data-[variant=pill]/toggle-group:text-muted-foreground group-data-[variant=pill]/toggle-group:hover:bg-transparent! group-data-[variant=pill]/toggle-group:aria-pressed:font-semibold group-data-[variant=pill]/toggle-group:aria-pressed:bg-transparent! group-data-[variant=pill]/toggle-group:aria-pressed:hover:bg-transparent! group-data-[variant=pill]/toggle-group:aria-pressed:border-transparent! group-data-[variant=pill]/toggle-group:has-data-[icon=inline-end]:pe-4 group-data-[variant=pill]/toggle-group:has-data-[icon=inline-start]:ps-4",
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
