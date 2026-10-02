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
  // Keep the mark brand-green with cream glyph; invert only flips the wordmark.
  const markBg = "#1f5a45";
  const markGlyph = "#f3efe6";
  const wordmark = invert ? "#f3efe6" : "#103b2f";

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
        <rect width="36" height="36" rx="10" fill={markBg} />
        {/* Clear capital P */}
        <path
          d="M12 26V10h6.4c3.55 0 5.85 1.9 5.85 4.85 0 2.95-2.3 4.85-5.85 4.85H14.6V26H12Zm2.6-8.7h3.55c1.95 0 3.15-1.05 3.15-2.6s-1.2-2.6-3.15-2.6H14.6v5.2Z"
          fill={markGlyph}
        />
      </svg>
      {showWordmark ? (
        <span
          className="text-lg font-bold tracking-tight"
          style={{ color: wordmark }}
        >
          PayEase
        </span>
      ) : null}
    </div>
  );
}
