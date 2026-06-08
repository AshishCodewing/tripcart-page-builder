"use client"

import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface CtaSectionProps {
  // Editorial slots (eyebrow / title / subtitle) come through `children` so
  // they render as individually selectable, RTE-editable GrapesJS text
  // components inside the canvas. The React shell only owns the wrapper
  // layout, decorative background, and CTA buttons.
  children?: ReactNode
  primaryLabel?: string
  primaryHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  imageSrc?: string
  imageAlt?: string
}

const buttonBase = cn(
  "inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold",
  "border transition-[background-color,color,border-color,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
  "focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-primary-foreground",
  "motion-reduce:transition-none"
)

export function CtaSection({
  children,
  primaryLabel,
  primaryHref = "#",
  secondaryLabel,
  secondaryHref = "#",
  imageSrc,
  imageAlt = "",
}: CtaSectionProps) {
  const hasButtons = Boolean(primaryLabel || secondaryLabel)
  return (
    <section className="relative isolate overflow-hidden bg-primary px-[clamp(1.25rem,5vw,4rem)] py-[clamp(4.5rem,9vw,7.5rem)] text-primary-foreground">
      {imageSrc ? (
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="100vw"
          className="absolute inset-0 -z-10 object-cover opacity-30"
        />
      ) : (
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-y-[40%] -right-[10%] -z-10 w-[60%] rotate-[18deg] bg-primary-foreground/[0.06]"
        />
      )}

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-[clamp(1rem,2vw,1.5rem)] text-center">
        {children}

        {hasButtons ? (
          <div className="mt-[clamp(0.75rem,1.5vw,1.25rem)] flex flex-wrap justify-center gap-3">
            {primaryLabel ? (
              <Link
                href={primaryHref}
                className={cn(
                  buttonBase,
                  "border-primary-foreground bg-primary-foreground text-primary",
                  "hover:-translate-y-px hover:bg-primary-foreground/90"
                )}
              >
                {primaryLabel}
              </Link>
            ) : null}
            {secondaryLabel ? (
              <Link
                href={secondaryHref}
                className={cn(
                  buttonBase,
                  "border-primary-foreground/40 bg-transparent text-primary-foreground",
                  "hover:border-primary-foreground hover:bg-primary-foreground/[0.08]"
                )}
              >
                {secondaryLabel}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
