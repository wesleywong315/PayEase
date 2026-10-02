import { formatHkdFromCents } from "@/lib/money";

type MoneyTextProps = {
  cents: number;
  className?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  align?: "left" | "right";
};

export function MoneyText({
  cents,
  className = "",
  label,
  size = "md",
  align = "left",
}: MoneyTextProps) {
  const formatted = formatHkdFromCents(cents);
  const sizeClass = size === "lg" ? "type-money-lg" : "type-money";
  const alignClass = align === "right" ? "text-right" : "text-left";

  return (
    <span
      className={`${sizeClass} ${alignClass} ${className}`}
      aria-label={label ? `${label}: ${formatted}` : formatted}
    >
      {formatted}
    </span>
  );
}
