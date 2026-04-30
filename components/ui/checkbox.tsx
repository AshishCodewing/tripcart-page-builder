import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

const checkboxVariants = cva(
  [
    "peer group/checkbox relative flex shrink-0 items-center justify-center rounded-[4px] border transition-colors outline-none",
    // hit area
    "after:absolute after:-inset-x-3 after:-inset-y-2",
    // focus
    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30",
    // disabled
    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
    // validation
    "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
    // unchecked
    "data-unchecked:border-border data-unchecked:bg-background",
    // checked
    "data-checked:border-primary data-checked:bg-primary/5 data-checked:text-primary",
    // indeterminate
    "data-indeterminate:border-primary data-indeterminate:bg-background data-indeterminate:text-primary",
    // disabled overrides checked/indeterminate to neutral
    "data-disabled:bg-muted data-disabled:data-checked:border-border data-disabled:data-checked:bg-muted data-disabled:data-checked:text-muted-foreground",
    "data-disabled:data-indeterminate:border-border data-disabled:data-indeterminate:bg-muted/50 data-disabled:data-indeterminate:text-muted-foreground",
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

function Checkbox({
  className,
  size = "default",
  ...props
}: CheckboxPrimitive.Root.Props & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      data-size={size}
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none group-data-[size=default]/checkbox:[&>svg]:size-3.5 group-data-[size=sm]/checkbox:[&>svg]:size-3"
      >
        <CheckIcon className="group-data-indeterminate/checkbox:hidden" />
        <MinusIcon className="hidden group-data-indeterminate/checkbox:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox, checkboxVariants }
