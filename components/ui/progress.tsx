import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={value}
      className={cn("relative w-full", className)}
      {...props}
    />
  )
}

function ProgressTrack({
  className,
  children,
  ...props
}: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted/50",
        className
      )}
      {...props}
    >
      {children ?? <ProgressIndicator />}
    </ProgressPrimitive.Track>
  )
}

function ProgressIndicator({
  className,
  style,
  ...props
}: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "h-full rounded-full bg-primary transition-[width] duration-300 ease-in-out",
        className
      )}
      style={
        {
          anchorName: "--progress-indicator",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label
      data-slot="progress-label"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      data-slot="progress-value"
      className={cn(
        "text-sm font-medium text-foreground tabular-nums",
        className
      )}
      {...props}
    />
  )
}

function ProgressFloatingValue({
  className,
  side = "top",
  sideOffset = 8,
  children,
  ...props
}: Omit<ProgressPrimitive.Value.Props, "children"> & {
  side?: "top" | "bottom"
  sideOffset?: number
  children?: ProgressPrimitive.Value.Props["children"]
}) {
  const anchorName = "--progress-indicator"
  const positionProps =
    side === "top"
      ? { bottom: "anchor(top)", translate: `-50% -${sideOffset}px` }
      : { top: "anchor(bottom)", translate: `-50% ${sideOffset}px` }

  return (
    <ProgressPrimitive.Value
      data-slot="progress-floating-value"
      className={cn(
        "pointer-events-none rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground tabular-nums opacity-0 shadow-lg transition-opacity group-hover:opacity-100",
        className
      )}
      style={
        {
          position: "absolute",
          positionAnchor: anchorName,
          left: "anchor(right)",
          ...positionProps,
        } as React.CSSProperties
      }
      {...props}
    >
      {children}
    </ProgressPrimitive.Value>
  )
}

function ProgressCircle({
  value = 0,
  size = 160,
  strokeWidth = 14,
  label,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  value?: number
  size?: number
  strokeWidth?: number
  label?: string
}) {
  const clampedValue = Math.min(Math.max(value, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = Math.PI * radius
  const offset = circumference - (clampedValue / 100) * circumference

  return (
    <div
      data-slot="progress-circle"
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("relative inline-flex flex-col items-center", className)}
      style={{ width: size, height: size / 2 + strokeWidth }}
      {...props}
    >
      <svg
        width={size}
        height={size / 2 + strokeWidth / 2}
        viewBox={`0 0 ${size} ${size / 2 + strokeWidth / 2}`}
        className="overflow-visible"
      >
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className="text-muted/50"
        />
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-500 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end">
        {label && (
          <span
            data-slot="progress-circle-label"
            className="text-xs font-medium text-muted-foreground"
          >
            {label}
          </span>
        )}
        {children ?? (
          <span
            data-slot="progress-circle-value"
            className="text-2xl leading-8 font-bold text-foreground"
          >
            {Math.round(clampedValue)}%
          </span>
        )}
      </div>
    </div>
  )
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
  ProgressFloatingValue,
  ProgressCircle,
}
