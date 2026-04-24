import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FirmLogoProps {
  logoUrl?: string | null;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<FirmLogoProps["size"]>, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-lg",
  lg: "h-14 w-14 rounded-xl",
  xl: "h-20 w-20 rounded-2xl",
};

const ICON_SIZE: Record<NonNullable<FirmLogoProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
};

export function FirmLogo({ logoUrl, name, size = "md", className }: FirmLogoProps) {
  const sizeClass = SIZE_CLASSES[size];
  const iconSize = ICON_SIZE[size];

  if (logoUrl) {
    return (
      <div
        className={cn(
          sizeClass,
          "overflow-hidden bg-muted flex items-center justify-center border",
          className,
        )}
      >
        <img
          src={logoUrl}
          alt={`${name} logo`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "bg-primary text-primary-foreground flex items-center justify-center",
        className,
      )}
    >
      <Building2 className={iconSize} />
    </div>
  );
}
