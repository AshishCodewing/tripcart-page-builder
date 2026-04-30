import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full rounded-md border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pe-18 has-[alert-description]:gap-1 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "text-primary *:data-[slot=alert-description]:text-foreground",
        destructive:
          "text-destructive *:data-[slot=alert-description]:text-foreground",
        warning: "text-warning *:data-[slot=alert-description]:text-foreground",
        success: "text-success *:data-[slot=alert-description]:text-foreground",
        neutral:
          "text-muted-foreground *:data-[slot=alert-description]:text-foreground",
      },
      fill: {
        filled: "",
        ghost: "border-transparent bg-transparent",
      },
    },
    compoundVariants: [
      {
        variant: "info",
        fill: "filled",
        class: "border-primary bg-primary/5",
      },
      {
        variant: "destructive",
        fill: "filled",
        class: "border-destructive bg-destructive/5",
      },
      {
        variant: "warning",
        fill: "filled",
        class: "border-warning bg-warning/5",
      },
      {
        variant: "success",
        fill: "filled",
        class: "border-success bg-success/5",
      },
      {
        variant: "neutral",
        fill: "filled",
        class: "border-border bg-muted/50",
      },
    ],
    defaultVariants: {
      variant: "default",
      fill: "filled",
    },
  }
)

function Alert({
  className,
  variant,
  fill,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, fill }), className)}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn(
        "alert-title leading-5 font-semibold group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "alert-description text-sm leading-5 text-balance text-muted-foreground group-has-[>svg]/alert:col-start-2 md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
        className
      )}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-action"
      className={cn("absolute inset-e-3 top-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants }
