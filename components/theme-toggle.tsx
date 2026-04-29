"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { Toggle } from "@/components/ui/toggle"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type Props = Omit<React.ComponentProps<typeof Toggle>, "pressed" | "onPressedChange" | "size"> & {
  size?: "default" | "sm" | "lg"
}

export function ThemeToggle({ className, size = "sm", ...props }: Props) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatch — server renders no theme info.
  const isDark = mounted ? resolvedTheme === "dark" : false
  const label = mounted
    ? isDark
      ? "Switch to light theme"
      : "Switch to dark theme"
    : "Toggle theme"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={
            <Toggle
              type="button"
              size={size}
              aria-label={label}
              pressed={isDark}
              onPressedChange={(next) => setTheme(next ? "dark" : "light")}
              className={cn(className)}
              {...props}
            >
              {mounted && isDark ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Toggle>
          }
        />
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
