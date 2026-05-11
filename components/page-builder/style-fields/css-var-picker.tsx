"use client"

import * as React from "react"
import { Braces } from "lucide-react"

import { InputGroupButton } from "@/components/ui/input-group"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger
} from "@/components/ui/combobox"

import { useThemeSelector } from "@/hooks/use-theme"

import { TOKENS, type Token, type TokenCategory } from "./open-props-tokens"

const HEX_RE = /^#[0-9a-f]{3,8}$/i

type CssVarPickerProps = {
  onSelect: (varExpr: string) => void
  categories?: TokenCategory[]
}

// "primary-foreground" → "primaryForeground"
const themeKeyToCamel = (name: string): string =>
  name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const tokenVarExpr = (token: Token): string =>
  token.category === "theme-color" ? `var(${token.value})` : `var(${token.name})`

const displayNameFor = (token: Token): string =>
  token.category === "theme-color" ? token.name : token.name.replace(/^--/, "")

export function CssVarPicker({ onSelect, categories }: CssVarPickerProps) {
  const [query, setQuery] = React.useState("")

  const themeColors = useThemeSelector((s) => s.theme.colors)

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

  return (
    <Combobox
      items={filtered}
      onValueChange={(value) => {
        if (value) {
          onSelect(value as string)
          setQuery("")
        }
      }}
    >
      <ComboboxTrigger
        className="[&>svg:last-child]:hidden"
        render={
          <InputGroupButton
            size="icon-xs"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Insert CSS variable"
          />
        }
      >
        <Braces className="size-3" />
      </ComboboxTrigger>

      {/*
       * Focus issue: CssVarPicker lives inside InputGroupAddon, which has an
       * onClick that calls querySelector("input")?.focus() to refocus the outer
       * property input. React portals bubble synthetic events through the React
       * component tree (not the DOM tree), so clicks inside this portaled popup
       * reach InputGroupAddon and steal focus from the Combobox search input.
       * Fix: stopPropagation on ComboboxContent blocks the event from reaching
       * InputGroupAddon.
       */}
      <ComboboxContent
        side="left"
        sideOffset={8}
        className="w-72! p-1"
        onClick={(e) => e.stopPropagation()}
      >
        <ComboboxInput
          showTrigger={false}
          placeholder="Search variable…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          spellCheck={false}
        />
        <ComboboxEmpty className="text-xs">No tokens match</ComboboxEmpty>
        <ComboboxList>
          {(token: Token) => {
            const liveValue =
              token.category === "theme-color"
                ? themeColors[themeKeyToCamel(token.name)]?.value
                : undefined
            const swatchColor =
              liveValue ??
              (token.category === "color" && HEX_RE.test(token.value)
                ? token.value
                : undefined)

            return (
              <ComboboxItem key={token.name} value={tokenVarExpr(token)}>
                {swatchColor && (
                  <span
                    className="size-3 shrink-0 rounded-sm border border-border/50"
                    style={{ backgroundColor: swatchColor }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 truncate text-xs">
                  {displayNameFor(token)}
                </span>
                <span className="shrink-0 truncate text-xs text-muted-foreground max-w-[40%]">
                  {liveValue ?? token.value}
                </span>
              </ComboboxItem>
            )
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
