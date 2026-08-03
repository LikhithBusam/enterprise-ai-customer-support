import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

interface SliderProps extends Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "aria-label"> {
  /** Radix's `Root` isn't the interactive element — each `Thumb` is (it's what actually gets
   * `role="slider"`) — so an `aria-label` on `Root` alone reaches no accessible name at all. This
   * applies the given label to every thumb; pass `thumbLabels` instead for a two-thumb range
   * slider where each end needs a distinct name (e.g. "Minimum latency" / "Maximum latency"). */
  "aria-label"?: string
  thumbLabels?: string[]
}

// forwardRef under React 18: Radix's Thumb is draggable/focusable and needs a ref for its own
// internal position tracking (same pattern as every other Radix primitive in this codebase).
const Slider = React.forwardRef<React.ComponentRef<typeof SliderPrimitive.Root>, SliderProps>(
  (
    { className, defaultValue, value, min = 0, max = 100, "aria-label": ariaLabel, thumbLabels, ...props },
    ref,
  ) => {
    const values = React.useMemo(
      () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
      [value, defaultValue, min, max],
    )

    return (
      <SliderPrimitive.Root
        ref={ref}
        data-slot="slider"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn(
          "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className="absolute rounded-full bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          />
        </SliderPrimitive.Track>
        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            aria-label={thumbLabels?.[index] ?? ariaLabel}
            className="block size-4 shrink-0 rounded-full border border-primary bg-background shadow-sm transition-[color,box-shadow] hover:ring-4 hover:ring-ring/50 focus-visible:ring-4 focus-visible:ring-ring/50 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Root>
    )
  },
)
Slider.displayName = "Slider"

export { Slider }
