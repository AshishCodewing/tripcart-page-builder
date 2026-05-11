"use client"

import * as React from "react"
import { Braces } from "lucide-react"

import { Input } from "@/components/ui/input"
import { InputGroupButton } from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

import { TOKENS, type Token, type TokenCategory } from "./open-props-tokens"

const HEX_RE = /^#[0-9a-f]{3,8}$/i

type CssVarPickerProps = {
  onSelect: (varExpr: string) => void
  categories?: TokenCategory[]
}

export function CssVarPicker({ onSelect, categories }: CssVarPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")

  const pool = React.useMemo(
    () =>
      categories
        ? TOKENS.filter((t) => categories.includes(t.category))
        : TOKENS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories?.join(",")]
  )

  const filtered = React.useMemo(() => {
    if (!query.trim()) return pool
    const q = query.toLowerCase().replace(/^--/, "")
    return pool.filter((t) => t.name.toLowerCase().includes(q))
  }, [query, pool])

  const handleSelect = (token: Token) => {
    onSelect(`var(${token.name})`)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Insert CSS variable"
          />
        }
      >
        <Braces className="size-3" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        side="left"
        sideOffset={8}
        className="w-72 p-0 gap-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b p-2">
          <Input
            inputSize="sm"
            placeholder="Search variable…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            spellCheck={false}
            className="h-7 text-xs"
          />
        </div>
        <ScrollArea className="h-72">
          <div className="flex flex-col py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                No tokens match &ldquo;{query}&rdquo;
              </p>
            ) : (
              filtered.map((token) => (
                <TokenRow
                  key={token.name}
                  token={token}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function TokenRow({
  token,
  onSelect,
}: {
  token: Token
  onSelect: (token: Token) => void
}) {
  const isColor = token.category === "color" && HEX_RE.test(token.value)
  const displayName = token.name.replace(/^--/, "")

  return (
    <button
      type="button"
      onClick={() => onSelect(token)}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
        "hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {isColor && (
        <span
          className="size-3 shrink-0 rounded-sm border border-border/50"
          style={{ backgroundColor: token.value }}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 flex-1 truncate text-xs">{displayName}</span>
      <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[40%]">
        {token.value}
      </span>
    </button>
  )
}
