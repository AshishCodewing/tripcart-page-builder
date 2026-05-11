"use client"

import * as React from "react"
import { Braces } from "lucide-react"

import { InputGroupButton } from "@/components/ui/input-group"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/ui/combobox"

import { useThemeSelector } from "@/hooks/use-theme"

import { TOKENS, type Token, type TokenCategory } from "./open-props-tokens"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type CssVarPickerProps = {
  onSelect: (varExpr: string) => void
  categories?: TokenCategory[]
}

// "primary-foreground" → "primaryForeground"
const themeKeyToCamel = (name: string): string =>
  name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

const tokenVarExpr = (token: Token): string => {
  if (token.category === "theme-color") return `var(${token.value})`
  if (token.category === "color") return `hsl(var(${token.name}))`
  return `var(${token.name})`
}

const displayNameFor = (token: Token): string => {
  if (token.category === "theme-color") return token.name
  return token.name.replace(/^--/, "").replace(/-hsl$/, "")
}

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

  const themeTokens = React.useMemo(
    () => filtered.filter((t) => t.category === "theme-color"),
    [filtered]
  )

  const otherTokens = React.useMemo(
    () => filtered.filter((t) => t.category !== "theme-color"),
    [filtered]
  )

  const renderToken = React.useCallback(
    (token: Token) => {
      const liveValue =
        token.category === "theme-color"
          ? themeColors[themeKeyToCamel(token.name)]?.value
          : undefined
      const swatchColor =
        liveValue ??
        (token.category === "color" ? `hsl(${token.value})` : undefined)

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
          <span className="shrink-0 max-w-[40%] truncate text-xs text-muted-foreground">
            {liveValue ?? token.value}
          </span>
        </ComboboxItem>
      )
    },
    [themeColors]
  )

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
      <Tooltip>
        <TooltipTrigger render={<span />}>
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
        </TooltipTrigger>
        <TooltipContent>Variables</TooltipContent>
      </Tooltip>


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
          className="[&_input]:h-7 [&_input]:text-xs"
        />
        <ComboboxEmpty className="text-xs">No tokens match</ComboboxEmpty>
        <ComboboxList>
          {themeTokens.length > 0 && (
            <ComboboxGroup items={themeTokens}>
              <ComboboxLabel className="px-1.5">Theme Colors</ComboboxLabel>
              <ComboboxCollection>{renderToken}</ComboboxCollection>
            </ComboboxGroup>
          )}
          {themeTokens.length > 0 && otherTokens.length > 0 && (
            <ComboboxSeparator />
          )}
          {otherTokens.length > 0 && (
            <ComboboxGroup items={otherTokens}>
              <ComboboxLabel className="px-1.5">Tokens</ComboboxLabel>
              <ComboboxCollection>{renderToken}</ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
