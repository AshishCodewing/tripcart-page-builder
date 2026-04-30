import * as React from "react"
import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const avatarVariants = cva(
  [
    "group/avatar relative flex shrink-0 overflow-clip select-none",
    "after:absolute after:inset-0 after:border after:border-border/50 after:mix-blend-darken dark:after:mix-blend-lighten",
  ].join(" "),
  {
    variants: {
      size: {
        xs: "size-6",
        sm: "size-8",
        md: "size-10",
        lg: "size-12",
        xl: "size-14",
      },
      variant: {
        circle: "rounded-full after:rounded-full",
        rounded: "rounded-sm after:rounded-sm",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "circle",
    },
  }
)

function Avatar({
  className,
  size = "md",
  variant = "circle",
  ...props
}: AvatarPrimitive.Root.Props & VariantProps<typeof avatarVariants>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      data-variant={variant}
      className={cn(avatarVariants({ size, variant }), className)}
      {...props}
    />
  )
}

function AvatarImage({ className, ...props }: AvatarPrimitive.Image.Props) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn(
        "aspect-square size-full rounded-[inherit] object-cover",
        className
      )}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: AvatarPrimitive.Fallback.Props) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center rounded-[inherit] border border-border/50 bg-card font-bold text-foreground",
        // text sizes per avatar size
        "group-data-[size=xs]/avatar:text-xs",
        "group-data-[size=sm]/avatar:text-sm",
        "group-data-[size=md]/avatar:text-base",
        "group-data-[size=lg]/avatar:text-lg",
        "group-data-[size=xl]/avatar:text-xl",
        // icon sizes per avatar size
        "group-data-[size=xs]/avatar:[&>svg]:size-4",
        "group-data-[size=sm]/avatar:[&>svg]:size-5",
        "group-data-[size=md]/avatar:[&>svg]:size-6",
        "group-data-[size=lg]/avatar:[&>svg]:size-7",
        "group-data-[size=xl]/avatar:[&>svg]:size-8",
        className
      )}
      {...props}
    />
  )
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute end-0 bottom-0 z-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground bg-blend-color ring-2 ring-background select-none",
        "group-data-[size=xs]/avatar:size-2 group-data-[size=xs]/avatar:[&>svg]:hidden",
        "group-data-[size=sm]/avatar:size-2 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=md]/avatar:size-2.5 group-data-[size=md]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3 group-data-[size=lg]/avatar:[&>svg]:size-2",
        "group-data-[size=xl]/avatar:size-3.5 group-data-[size=xl]/avatar:[&>svg]:size-2.5",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-2 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background",
        "group-has-data-[size=xs]/avatar-group:size-6 group-has-data-[size=xs]/avatar-group:text-xs",
        "group-has-data-[size=sm]/avatar-group:size-8 group-has-data-[size=sm]/avatar-group:text-sm",
        "group-has-data-[size=lg]/avatar-group:size-12 group-has-data-[size=lg]/avatar-group:text-base",
        "group-has-data-[size=xl]/avatar-group:size-14 group-has-data-[size=xl]/avatar-group:text-lg",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarBadge,
  avatarVariants,
}
