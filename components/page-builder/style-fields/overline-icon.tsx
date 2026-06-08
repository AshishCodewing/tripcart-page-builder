import { forwardRef } from "react"
import { Underline } from "lucide-react"
import type { LucideProps } from "lucide-react"

export const OverlineIcon = forwardRef<SVGSVGElement, Omit<LucideProps, "ref">>(
  ({ className, ...props }, ref) => (
    <Underline
      ref={ref}
      className={`rotate-180 ${className ?? ""}`}
      {...props}
    />
  )
)
OverlineIcon.displayName = "OverlineIcon"
