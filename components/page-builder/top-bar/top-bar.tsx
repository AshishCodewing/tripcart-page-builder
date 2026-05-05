"use client"

import * as React from "react"
import { WithEditor } from "@grapesjs/react"

import { cn } from "@/lib/utils"
import {
  contentKindLabel,
  contentTitle,
  type EditorContent,
} from "@/components/page-builder/types"
import TopBarLeft from "./top-bar-left"
import TopBarRight from "./top-bar-right"

type Props = {
  content: EditorContent
  className?: string
}

export default function TopBar({ content, className }: Props) {
  return (
    <div
      className={cn(
        "gjs-top-bar grid grid-cols-3 items-center gap-2 border-b bg-background px-2 py-1",
        className
      )}
    >
      <div className="justify-self-start">
        <WithEditor>
          <TopBarLeft />
        </WithEditor>
      </div>

      <div className="justify-self-center text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          {contentTitle(content)}
        </span>
        <span className="mx-2">·</span>
        <span>{contentKindLabel(content)}</span>
      </div>

      <TopBarRight content={content} />
    </div>
  )
}
