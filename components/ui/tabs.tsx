import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list relative inline-flex w-fit items-center justify-center text-muted-foreground group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        fill: "rounded-[8px] border border-border bg-muted p-1",
        line: "rounded-none border-b border-border bg-transparent",
      },
    },
    defaultVariants: {
      variant: "fill",
    },
  }
)

function TabsList({
  className,
  variant = "fill",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        // base
        "relative z-10 inline-flex items-center justify-center gap-1.5 px-4 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground [transition-property:color,transform] duration-[260ms] [transition-timing-function:cubic-bezier(0.77,0,0.175,1)] outline-none group-data-[activation-direction=none]/tabs-list:transition-none group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // fill variant
        "group-data-[variant=fill]/tabs-list:rounded-[6px]",
        "group-data-[variant=fill]/tabs-list:data-active:text-primary-foreground",
        // line variant
        "group-data-[variant=line]/tabs-list:data-active:text-primary",
        className
      )}
      {...props}
    />
  )
}

function TabsIndicator({ className, ...props }: TabsPrimitive.Indicator.Props) {
  return (
    <TabsPrimitive.Indicator
      data-slot="tabs-indicator"
      className={cn(
        "absolute transition-[top,left,width,height] duration-[260ms] [transition-timing-function:cubic-bezier(0.77,0,0.175,1)] will-change-transform data-[activation-direction=none]:transition-none",
        // fill variant (CSS vars handle both orientations)
        "group-data-[variant=fill]/tabs-list:top-[var(--active-tab-top)] group-data-[variant=fill]/tabs-list:left-[var(--active-tab-left)] group-data-[variant=fill]/tabs-list:h-[var(--active-tab-height)] group-data-[variant=fill]/tabs-list:w-[var(--active-tab-width)] group-data-[variant=fill]/tabs-list:rounded-[6px] group-data-[variant=fill]/tabs-list:bg-primary group-data-[variant=fill]/tabs-list:shadow-[0px_2px_2px_-1px_rgba(0,0,0,0.2)]",
        // line variant — shared
        "group-data-[variant=line]/tabs-list:rounded-full group-data-[variant=line]/tabs-list:bg-primary",
        // line variant — horizontal
        "group-data-[variant=line]/tabs-list:data-horizontal:bottom-0 group-data-[variant=line]/tabs-list:data-horizontal:left-[var(--active-tab-left)] group-data-[variant=line]/tabs-list:data-horizontal:h-[2px] group-data-[variant=line]/tabs-list:data-horizontal:w-[var(--active-tab-width)] group-data-[variant=line]/tabs-list:data-horizontal:translate-y-px",
        // line variant — vertical
        "group-data-[variant=line]/tabs-list:data-vertical:end-0 group-data-[variant=line]/tabs-list:data-vertical:top-[var(--active-tab-top)] group-data-[variant=line]/tabs-list:data-vertical:h-[var(--active-tab-height)] group-data-[variant=line]/tabs-list:data-vertical:w-[2px] group-data-[variant=line]/tabs-list:data-vertical:translate-x-px",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsIndicator,
  TabsContent,
  tabsListVariants,
}
