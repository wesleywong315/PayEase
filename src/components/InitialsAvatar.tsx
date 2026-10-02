type InitialsAvatarProps = {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClass = {
  sm: "h-9 w-9 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
};

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function InitialsAvatar({
  name,
  size = "md",
  className = "",
}: InitialsAvatarProps) {
  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary ${sizeClass[size]} ${className}`}
      aria-hidden="true"
    >
      {initialsFromName(name)}
    </div>
  );
}
