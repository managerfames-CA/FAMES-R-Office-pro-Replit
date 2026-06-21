import { cn } from "@/lib/utils";

interface PnlDisplayProps {
  value: number | null | undefined;
  percent?: number | null | undefined;
  prefix?: string;
  className?: string;
  currency?: boolean;
}

export function PnlDisplay({ value, percent, prefix = "", className, currency = true }: PnlDisplayProps) {
  if (value == null) return <span className="text-muted-foreground">-</span>;

  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const formattedValue = new Intl.NumberFormat("en-US", {
    style: currency ? "currency" : "decimal",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));

  const formattedPercent = percent != null ? new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(percent) / 100) : null;

  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-mono font-medium",
          isPositive && "text-green-500",
          isNegative && "text-destructive",
          isZero && "text-muted-foreground"
        )}
      >
        {prefix}
        {isPositive ? "+" : isNegative ? "-" : ""}
        {formattedValue}
      </span>
      {formattedPercent && (
        <span
          className={cn(
            "text-xs font-mono",
            isPositive && "text-green-500/80",
            isNegative && "text-destructive/80",
            isZero && "text-muted-foreground/80"
          )}
        >
          {isPositive ? "+" : isNegative ? "-" : ""}
          {formattedPercent}
        </span>
      )}
    </div>
  );
}
