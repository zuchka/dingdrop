import * as React from "react";
import * as RechartsPrimitive from "recharts";
import { cn } from "~/lib/utils";

// Chart Container
const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config?: Record<string, { label?: string; color?: string }>;
  }
>(({ className, children, config, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("", className)} {...props}>
      {children}
    </div>
  );
});
ChartContainer.displayName = "ChartContainer";

// Chart Tooltip
const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
  }
>(
  (
    {
      className,
      hideLabel = false,
      hideIndicator = false,
      indicator = "dot",
      nameKey,
      labelKey,
      ...props
    },
    ref
  ) => {
    const { payload, label } = props as any;

    if (!payload?.length) {
      return null;
    }

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-white px-3 py-2 shadow-md",
          className
        )}
      >
        {!hideLabel && label && (
          <div className="mb-1 text-xs font-medium text-slate-900">{label}</div>
        )}
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              {!hideIndicator && (
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    indicator === "line" && "w-3 h-0.5"
                  )}
                  style={{ backgroundColor: item.color }}
                />
              )}
              <span className="text-slate-600">{item.name}:</span>
              <span className="font-medium text-slate-900">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

// Chart Legend
const ChartLegend = RechartsPrimitive.Legend;

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    hideIcon?: boolean;
  }
>(({ className, hideIcon = false, ...props }, ref) => {
  const { payload } = props as any;

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4", className)}
    >
      {payload.map((item: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5">
          {!hideIcon && (
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
          )}
          <span className="text-xs text-slate-600">{item.value}</span>
        </div>
      ))}
    </div>
  );
});
ChartLegendContent.displayName = "ChartLegendContent";

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
};
