type StatusTone = "neutral" | "success" | "warning" | "danger" | "accent";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-border/40 text-muted",
  success: "bg-accent-soft text-accent",
  warning: "bg-warning-bg text-warning",
  danger: "bg-danger-bg text-danger",
  accent: "bg-accent-soft text-foreground",
};

const STATUS_TONES: Record<string, StatusTone> = {
  DRAFT: "neutral",
  COMMITTED: "success",
  CANCELLED: "danger",
  OPEN: "accent",
  CLOSED: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  ACCEPTED: "success",
  PROPOSED: "warning",
  ACTIVE: "success",
  LEFT: "neutral",
  COORDINATOR: "accent",
  MEMBER: "neutral",
  RECEIVED: "success",
  PLEDGED: "warning",
};

type StatusBadgeProps = {
  status: string;
  className?: string;
};

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const tone = STATUS_TONES[status] ?? "neutral";

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold tracking-wide ${TONE_CLASSES[tone]} ${className}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
