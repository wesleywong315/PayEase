type LogoProps = {
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  invert?: boolean;
};

export function Logo({
  className = "",
  markClassName = "",
  showWordmark = true,
  invert = false,
}: LogoProps) {
  const ink = invert ? "#f3efe6" : "#103b2f";
  const accent = invert ? "#f3efe6" : "#1f5a45";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width="36"
        height="36"
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={markClassName}
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="10" fill={accent} />
        <path
          d="M10 22.5V13.5h4.2c2.4 0 3.9 1.2 3.9 3.1 0 1.3-.7 2.3-1.9 2.8L19.5 22.5h-2.5l-2.9-2.9H12.4V22.5H10Zm2.4-4.6h1.7c1.1 0 1.8-.5 1.8-1.4s-.7-1.4-1.8-1.4h-1.7v2.8Z"
          fill={invert ? "#2b5a43" : "#f3efe6"}
        />
        <circle cx="24.5" cy="14" r="2.2" fill={ink === accent ? "#f3efe6" : ink} opacity="0.9" />
      </svg>
      {showWordmark ? (
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: invert ? "#f3efe6" : undefined }}
        >
          PayEase
        </span>
      ) : null}
    </div>
  );
}
