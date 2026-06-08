import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Title-case a kebab- or snake-cased token. GrapesJS often returns CSS values
// verbatim as option labels ("inline-block", "flex-start"), which look out of
// place in title-case UI surfaces — humanize them at the render boundary.
// Idempotent for already-titled inputs ("Inline Block" → "Inline Block").
export function humanizeLabel(value: string): string {
  if (!value) return value
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}
