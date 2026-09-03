"use client"

import { SearchIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { STYLE_BOOK_ENTRIES } from "@/lib/theme/style-book"

type Props = {
  query: string
  onQueryChange: (next: string) => void
  onSelect: (entryId: string) => void
}

export default function BlockList({ query, onQueryChange, onSelect }: Props) {
  const needle = query.trim().toLowerCase()
  const entries = STYLE_BOOK_ENTRIES.filter((entry) =>
    entry.label.toLowerCase().includes(needle)
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Set how each block looks across the whole site. Changes apply everywhere
        that block is used.
      </p>

      <InputGroup>
        <InputGroupAddon>
          <SearchIcon className="size-4" aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search blocks"
          aria-label="Search blocks"
        />
      </InputGroup>

      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No blocks match “{query}”.
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelect(entry.id)}
                className="w-full rounded-md px-2 py-2 text-start text-sm hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {entry.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
