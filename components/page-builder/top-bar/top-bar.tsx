"use client"

import * as React from "react"
import { WithEditor } from "@grapesjs/react"

import { cn } from "@/lib/utils"
import TopBarLeft from "./top-bar-left"
import TopBarRight from "./top-bar-right"

type PageSummary = {
  id: string
  title: string
  path: string
}

type Props = React.HTMLAttributes<HTMLDivElement> & {
  page: PageSummary
}

export default function TopBar({ page, className, ...rest }: Props) {
  return (
    <div
      className={cn(
        "gjs-top-bar grid grid-cols-3 items-center gap-2 border-b bg-background px-2 py-1",
        className
      )}
      {...rest}
    >
      <div className="justify-self-start">
        <WithEditor>
          <TopBarLeft />
        </WithEditor>
      </div>

      <div className="justify-self-center text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{page.title}</span>
        <span className="mx-2">·</span>
        <span>Page</span>
      </div>

      <TopBarRight page={page} />
    </div>
  )
}
