"use client"

import * as React from "react"
import { DevicesProvider } from "@grapesjs/react"
import {
  Monitor,
  MoreVertical,
  Smartphone,
  Tablet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { ThemeToggle } from "@/components/theme-toggle"

type PageSummary = {
  id: string
  path: string
}

type Props = React.HTMLAttributes<HTMLDivElement> & {
  page: PageSummary
}

function getDeviceIcon(id: string): LucideIcon {
  const v = id.toLowerCase()
  if (v.includes("mobile") || v.includes("phone")) return Smartphone
  if (v.includes("tablet")) return Tablet
  return Monitor
}

export default function TopBarRight({ page, className, ...rest }: Props) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2", className)}
      {...rest}
    >
      <Button
        type="submit"
        name="status"
        value="DRAFT"
        variant="ghost"
        size="sm"
        className="text-primary"
      >
        Save draft
      </Button>

      <DevicesProvider>
        {({ selected, select, devices }) => (
          <ToggleGroup
            variant="pill"
            size="sm"
            aria-label="Device"
            value={selected ? [selected] : []}
            onValueChange={(value) => {
              const id = value[0]
              if (id) select(id)
            }}
          >
            {devices
              .filter((device) => {
                const id = String(device.id).toLowerCase()
                const name = (device.getName() ?? "").toLowerCase()
                return (
                  !id.includes("landscape") && !name.includes("landscape")
                )
              })
              .map((device) => {
                const id = String(device.id)
                const label = device.getName() ?? id
                const Icon = getDeviceIcon(id)
                return (
                  <ToggleGroupItem
                    key={id}
                    value={id}
                    aria-label={label}
                    className="group-data-[variant=pill]/toggle-group:px-2"
                  >
                    <Icon className="size-4" />
                  </ToggleGroupItem>
                )
              })}
          </ToggleGroup>
        )}
      </DevicesProvider>

      <SidebarTrigger type="button" aria-label="Toggle settings sidebar" />

      <Button type="submit" name="status" value="PUBLISHED" size="sm">
        Publish
      </Button>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More"
            >
              <MoreVertical className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            render={
              <a
                href={`/api/preview?path=/${encodeURIComponent(page.path)}`}
                target="_blank"
                rel="noreferrer"
              >
                Preview
              </a>
            }
          />
          <DropdownMenuItem render={<Link href="/admin/pages" />}>
            Back to pages
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled className="font-mono text-xs">
            /{page.path}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
