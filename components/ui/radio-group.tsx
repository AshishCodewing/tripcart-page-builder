import { Radio as RadioPrimitive } from "@base-ui/react/radio"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid w-full gap-2", className)}
      {...props}
    />
  )
}

const radioGroupItemVariants = cva(
  [
    "group/radio peer relative flex shrink-0 rounded-full border outline-none",
    // hit area
    "after:absolute after:-inset-x-3 after:-inset-y-2",
    // focus
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
    // validation
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    // unchecked
    "data-unchecked:border-muted-foreground/50 data-unchecked:bg-background",
    // checked
    "data-checked:border-primary data-checked:bg-primary/5 data-checked:text-primary",
    // disabled
    "data-disabled:cursor-not-allowed data-disabled:bg-card data-disabled:border-border",
    // disabled overrides checked to neutral
    "data-disabled:data-checked:border-border data-disabled:data-checked:bg-card data-disabled:data-checked:text-muted-foreground",
  ].join(" "),
  {
    variants: {
      size: {
        default: "size-5",
        sm: "size-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function RadioGroupItem({
  className,
  size = "default",
  ...props
}: RadioPrimitive.Root.Props & VariantProps<typeof radioGroupItemVariants>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      data-size={size}
      className={cn(radioGroupItemVariants({ size }), className)}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center size-full"
      >
        <span
          className={cn(
            "rounded-full bg-current",
            size === "default" ? "size-2" : "size-1.5"
          )}
        />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem, radioGroupItemVariants }
