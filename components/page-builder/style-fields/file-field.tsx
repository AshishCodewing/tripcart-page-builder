"use client"

import { useEditor } from "@grapesjs/react"
import type { Property } from "grapesjs"
import { Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export default function FileField({ property }: { property: Property }) {
  const editor = useEditor()
  const value = String(property.getValue() ?? "")

  const open = () => {
    editor.AssetManager.open({
      types: ["image"],
      select: (asset, complete) => {
        const src = typeof asset === "string" ? asset : asset.getSrc()
        property.upValue(src)
        if (complete) editor.AssetManager.close()
      },
    })
  }

  return (
    <div className="flex w-full items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 flex-1 justify-start truncate text-xs font-normal"
        onClick={open}
      >
        {value || "Select asset…"}
      </Button>
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => property.clear()}
          aria-label="Clear asset"
        >
          <Trash2 className="size-3" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  )
}
