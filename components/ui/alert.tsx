import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const alertVariants = cva(
  "group/alert relative grid w-full rounded-md border px-4 py-3 text-start text-sm has-data-[slot=alert-action]:relative has-[alert-description]:gap-1 has-data-[slot=alert-action]:pe-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-3 *:[svg]:row-span-2 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "text-primary *:data-[slot=alert-description]:text-foreground",
        destructive:
          "text-destructive *:data-[slot=alert-description]:text-foreground",
        warning:
          "text-warning *:data-[slot=alert-description]:text-foreground",
        success:
          "text-success *:data-[slot=alert-description]:text-foreground",
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
        class: "bg-primary/5 border-primary",
      },
      {
        variant: "destructive",
        fill: "filled",
        class: "bg-destructive/5 border-destructive",
      },
      {
        variant: "warning",
        fill: "filled",
        class: "bg-warning/5 border-warning",
      },
      {
        variant: "success",
        fill: "filled",
        class: "bg-success/5 border-success",
      },
      {
        variant: "neutral",
        fill: "filled",
        class: "bg-muted/50 border-border",
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
        "alert-title font-semibold leading-5 group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
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
        "alert-description text-sm leading-5 text-balance text-muted-foreground md:text-pretty group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
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
      className={cn("absolute top-3 inset-e-3", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, alertVariants }
