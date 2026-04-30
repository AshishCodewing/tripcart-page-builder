import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-full border border-transparent px-2 py-0.5 font-semibold whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "",
        secondary: "",
        success: "",
        warning: "",
        destructive: "",
      },
      fill: {
        filled: "",
        faded: "",
        outline: "bg-transparent",
      },
      size: {
        sm: "h-5 text-[11px] leading-[18px]",
        md: "h-6 text-[13px] leading-5",
      },
    },
    compoundVariants: [
      // Filled
      {
        variant: "default",
        fill: "filled",
        class: "bg-primary text-primary-foreground",
      },
      {
        variant: "secondary",
        fill: "filled",
        class: "bg-foreground text-background",
      },
      {
        variant: "success",
        fill: "filled",
        class: "bg-success text-success-foreground",
      },
      {
        variant: "warning",
        fill: "filled",
        class: "bg-warning text-warning-foreground",
      },
      {
        variant: "destructive",
        fill: "filled",
        class: "bg-destructive text-white",
      },
      // Faded
      {
        variant: "default",
        fill: "faded",
        class: "border-primary/10 bg-primary/10 text-primary",
      },
      {
        variant: "secondary",
        fill: "faded",
        class: "border-foreground/10 bg-muted/50 text-foreground",
      },
      {
        variant: "success",
        fill: "faded",
        class: "border-success/10 bg-success/5 text-success",
      },
      {
        variant: "warning",
        fill: "faded",
        class: "border-warning/10 bg-warning/5 text-warning",
      },
      {
        variant: "destructive",
        fill: "faded",
        class: "border-destructive/10 bg-destructive/5 text-destructive",
      },
      // Outline
      {
        variant: "default",
        fill: "outline",
        class: "border-primary text-primary",
      },
      {
        variant: "secondary",
        fill: "outline",
        class: "border-border text-foreground",
      },
      {
        variant: "success",
        fill: "outline",
        class: "border-success text-success",
      },
      {
        variant: "warning",
        fill: "outline",
        class: "border-warning text-warning",
      },
      {
        variant: "destructive",
        fill: "outline",
        class: "border-destructive text-destructive",
      },
    ],
    defaultVariants: {
      variant: "default",
      fill: "filled",
      size: "sm",
    },
  }
)

function Badge({
  className,
  variant = "default",
  fill = "filled",
  size = "sm",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, fill, size }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
      fill,
      size,
    },
  })
}

function BadgeDot({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge-dot"
      className={cn("size-1.5 shrink-0 rounded-full bg-current", className)}
      {...props}
    />
  )
}

export { Badge, BadgeDot, badgeVariants }
