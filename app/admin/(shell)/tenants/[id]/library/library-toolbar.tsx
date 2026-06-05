"use client"

import { ListFilterIcon, SearchIcon, Settings2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

export type SourceFilter = "" | "tenant" | "global"

type Props = {
  query: string
  source: SourceFilter
  onQueryChange: (value: string) => void
  onSourceChange: (value: SourceFilter) => void
}

const SOURCE_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "tenant", label: "This tenant" },
  { value: "global", label: "Global library" },
]

/**
 * Search + filter controls for the Library pages. Fully controlled — the
 * library chrome owns the state (mirrored to the URL). The settings
 * button is a visual stub for now.
 */
export function LibraryToolbar({
  query,
  source,
  onQueryChange,
  onSourceChange,
}: Props) {
  const activeFilters = source ? 1 : 0

  return (
    <div className="flex items-center gap-2">
      <InputGroup className="max-w-xs">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </InputGroup>

      <Popover>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Filter"
            />
          }
        >
          <ListFilterIcon />
          {activeFilters > 0 && (
            <span className="absolute -top-1 -end-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {activeFilters}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 gap-0">
          <PopoverHeader className="flex-row items-center justify-between">
            <PopoverTitle>Filters</PopoverTitle>
            {activeFilters > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onSourceChange("")}
              >
                Reset
              </Button>
            )}
          </PopoverHeader>

          <FilterSection
            label="Source"
            name="source"
            value={source}
            options={SOURCE_OPTIONS}
            onChange={(v) => onSourceChange(v as SourceFilter)}
          />
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Settings"
        className="ms-auto"
      >
        <Settings2Icon />
      </Button>
    </div>
  )
}

function FilterSection({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string
  name: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-2 py-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <RadioGroup value={value} onValueChange={(v) => onChange(String(v))}>
        {options.map((opt) => {
          const id = `${name}-${opt.value || "all"}`
          return (
            <Label
              key={id}
              htmlFor={id}
              className="flex items-center gap-2 font-normal"
            >
              <RadioGroupItem id={id} value={opt.value} size="sm" />
              {opt.label}
            </Label>
          )
        })}
      </RadioGroup>
    </div>
  )
}
