"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { useLeftPanel } from "./left-panel-context"
import { LEFT_PANELS } from "./panels"

/**
 * Persistent icon rail (VS Code "activity bar"). Always visible — it fills the
 * sidebar's icon-collapsed width, so the panel body can hide while the rail
 * stays put. Clicking an icon toggles its panel via `togglePanel`.
 */
export default function LeftRail() {
  const { activeMode, togglePanel } = useLeftPanel()

  return (
    <TooltipProvider delay={500}>
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-e py-2">
        {LEFT_PANELS.map(({ mode, label, icon: Icon }) => {
          const active = activeMode === mode
          return (
            <Tooltip key={mode}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={label}
                    aria-pressed={active}
                    onClick={() => togglePanel(mode)}
                    className={cn(
                      active &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    )}
                  >
                    <Icon />
                  </Button>
                }
              />
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
