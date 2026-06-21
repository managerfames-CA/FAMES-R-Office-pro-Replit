import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";

interface DirectionBadgeProps {
  direction: string | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export function DirectionBadge({ direction, className, showLabel = true }: DirectionBadgeProps) {
  if (!direction) return <span className="text-muted-foreground">-</span>;

  const isLong = direction.toUpperCase() === "LONG";

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-semibold",
        isLong ? "text-green-500" : "text-destructive",
        className
      )}
    >
      {isLong ? (
        <ArrowUp className="w-3.5 h-3.5 mr-1" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 mr-1" />
      )}
      {showLabel && direction.toUpperCase()}
    </span>
  );
}
