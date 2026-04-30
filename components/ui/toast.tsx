import * as React from "react"
import { Toast } from "@base-ui/react/toast"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

type ToastType = "success" | "destructive" | "warning" | "info"

const toastVariants = cva(
  "group/toast absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] flex h-[var(--height)] w-full origin-bottom [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] border bg-clip-padding shadow-lg select-none [--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s] after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-[''] data-[ending-style]:opacity-0 data-[expanded]:h-[var(--toast-height)] data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-[limited]:opacity-0 data-[starting-style]:[transform:translateY(150%)] data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[expanded]:data-[ending-style]:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] data-[expanded]:data-[ending-style]:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] [&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
  {
    variants: {
      variant: {
        success: "border-success",
        destructive: "border-destructive",
        warning: "border-warning",
        info: "border-primary",
      },
      size: {
        default:
          "items-start gap-4 rounded-md bg-background p-6 before:absolute before:inset-y-[-1px] before:left-[-1px] before:w-1 before:rounded-l-md",
        compact:
          "items-center gap-2 rounded-md p-3 [&>svg]:shrink-0 [&>svg:not([class*='size-'])]:size-6",
      },
    },
    compoundVariants: [
      // Default size: left accent bar
      { size: "default", variant: "success", class: "before:bg-success" },
      {
        size: "default",
        variant: "destructive",
        class: "before:bg-destructive",
      },
      { size: "default", variant: "warning", class: "before:bg-warning" },
      { size: "default", variant: "info", class: "before:bg-primary" },
      // Compact: solid tinted bg
      { size: "compact", variant: "success", class: "bg-toast-success" },
      {
        size: "compact",
        variant: "destructive",
        class: "bg-toast-destructive",
      },
      { size: "compact", variant: "warning", class: "bg-toast-warning" },
      { size: "compact", variant: "info", class: "bg-toast-info" },
    ],
    defaultVariants: {
      variant: "info",
      size: "default",
    },
  }
)

const toastIconVariants = cva(
  "flex size-12 shrink-0 items-center justify-center rounded-lg shadow-[0px_12px_10.6px_-4px_rgba(0,0,0,0.24)] [&>svg]:text-white [&>svg:not([class*='size-'])]:size-7",
  {
    variants: {
      variant: {
        success: "bg-success",
        destructive: "bg-destructive",
        warning: "bg-warning",
        info: "bg-primary",
      },
    },
  }
)

function ToastProvider({
  timeout = 5000,
  limit = 5,
  ...props
}: React.ComponentProps<typeof Toast.Provider>) {
  return <Toast.Provider timeout={timeout} limit={limit} {...props} />
}

function ToastViewport({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Viewport>) {
  return (
    <Toast.Portal>
      <Toast.Viewport
        data-slot="toast-viewport"
        className={cn(
          "fixed top-auto right-[1rem] bottom-[1rem] z-10 mx-auto flex w-full max-w-md sm:right-[2rem] sm:bottom-[2rem]",
          className
        )}
        {...props}
      />
    </Toast.Portal>
  )
}

function ToastRoot({
  className,
  toast: toastObj,
  size = "default",
  ...props
}: React.ComponentProps<typeof Toast.Root> & {
  size?: "default" | "compact"
}) {
  const variant = (toastObj.type as ToastType) || "info"
  // Detect toast updates by watching for content changes while mounted.
  // update() keeps the same toast mounted; add() with a new id remounts.
  const [prevContent, setPrevContent] = React.useState({
    title: toastObj.title,
    description: toastObj.description,
    type: toastObj.type,
  })
  const [pulseKey, setPulseKey] = React.useState(0)
  if (
    prevContent.title !== toastObj.title ||
    prevContent.description !== toastObj.description ||
    prevContent.type !== toastObj.type
  ) {
    setPrevContent({
      title: toastObj.title,
      description: toastObj.description,
      type: toastObj.type,
    })
    setPulseKey((k) => k + 1)
  }
  const pulse = pulseKey > 0 ? (pulseKey % 2 === 0 ? "even" : "odd") : undefined
  return (
    <Toast.Root
      data-slot="toast"
      data-size={size}
      toast={toastObj}
      className={cn(
        toastVariants({ variant, size }),
        pulse === "odd" && "animate-toast-pulse-odd",
        pulse === "even" && "animate-toast-pulse-even",
        className
      )}
      {...props}
    />
  )
}

function ToastContent({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Content>) {
  return (
    <Toast.Content
      data-slot="toast-content"
      className={cn(
        "overflow-hidden transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function ToastTitle({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Title>) {
  return (
    <Toast.Title
      data-slot="toast-title"
      className={cn(
        "text-lg leading-7 font-bold text-foreground",
        "group-data-[size=compact]/toast:flex-1 group-data-[size=compact]/toast:text-base group-data-[size=compact]/toast:leading-6 group-data-[size=compact]/toast:font-medium group-data-[size=compact]/toast:text-current",
        className
      )}
      {...props}
    />
  )
}

function ToastDescription({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Description>) {
  return (
    <Toast.Description
      data-slot="toast-description"
      className={cn("text-sm leading-5 text-foreground", className)}
      {...props}
    />
  )
}

function ToastClose({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Close>) {
  return (
    <Toast.Close
      data-slot="toast-close"
      className={cn(
        "absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-sm border-none bg-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-700",
        className
      )}
      {...props}
    />
  )
}

function ToastAction({
  className,
  ...props
}: React.ComponentProps<typeof Toast.Action>) {
  return (
    <Toast.Action
      data-slot="toast-action"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold underline transition-opacity hover:opacity-80 [&>svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

function ToastIcon({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof toastIconVariants>) {
  return (
    <div
      data-slot="toast-icon"
      className={cn(toastIconVariants({ variant }), className)}
      {...props}
    />
  )
}

const useToastManager = Toast.useToastManager
const createToastManager = Toast.createToastManager

export {
  ToastProvider,
  ToastViewport,
  ToastRoot,
  ToastContent,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  ToastIcon,
  useToastManager,
  createToastManager,
  toastVariants,
  toastIconVariants,
}

export type { ToastType }
