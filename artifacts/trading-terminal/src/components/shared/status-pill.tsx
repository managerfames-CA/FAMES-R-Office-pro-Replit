import { cn } from "@/lib/utils";

interface StatusPillProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusPill({ status, className }: StatusPillProps) {
  if (!status) return <span className="text-muted-foreground">-</span>;

  const getStatusStyles = (s: string) => {
    switch (s.toLowerCase()) {
      case "active":
      case "open":
      case "running":
        return "bg-teal-500/10 text-teal-500 border-teal-500/30";
      case "stopped_profit":
      case "tp1":
      case "tp2":
      case "closed":
      case "executed":
        return "bg-green-500/10 text-green-500 border-green-500/30";
      case "stopped_loss":
      case "sl":
      case "cancelled":
      case "expired":
      case "rejected":
        return "bg-red-500/10 text-red-500 border-red-500/30";
      case "idle":
      case "pending":
      case "manual":
      case "sessionstop":
        return "bg-gray-500/10 text-gray-400 border-gray-500/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize",
        getStatusStyles(status),
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
