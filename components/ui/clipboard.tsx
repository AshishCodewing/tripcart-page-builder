import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { CopyIcon, CheckIcon } from "lucide-react"

const clipboardVariants = cva("inline-flex items-center gap-2", {
  variants: {
    variant: {
      field: "",
      inline: "",
      block: "",
    },
  },
  defaultVariants: {
    variant: "field",
  },
})

function Clipboard({
  className,
  variant = "field",
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> &
  VariantProps<typeof clipboardVariants> & {
    value: string
  }) {
  const [copied, setCopied] = React.useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      data-slot="clipboard"
      className={cn(clipboardVariants({ variant }), className)}
      {...props}
    >
      <div
        data-slot="clipboard-code"
        className={cn(
          "flex items-center font-mono text-sm leading-5 overflow-hidden shadow-xs",
          variant === "field" &&
            "flex-1 border border-border rounded-md h-10 bg-background px-3 py-1",
          variant === "inline" &&
            "bg-muted/50 rounded-[2px] px-3 py-0.5",
          variant === "block" &&
            "bg-foreground rounded-[2px] px-3 py-2.5"
        )}
      >
        <span
          className={cn(
            "truncate",
            variant === "block" ? "text-background" : "text-foreground/80"
          )}
        >
          {value}
        </span>
      </div>

      {variant === "field" && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? (
            <CheckIcon className="text-success" />
          ) : (
            <CopyIcon />
          )}
        </Button>
      )}

      {variant === "inline" && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? (
            <CheckIcon className="size-4 text-success" />
          ) : (
            <CopyIcon className="size-4" />
          )}
        </button>
      )}

      {variant === "block" && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  )
}

export { Clipboard, clipboardVariants }
