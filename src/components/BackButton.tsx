import Link from "next/link";

type BackButtonProps = {
  /** Parent page in the navigation hierarchy (not browser history). */
  href: string;
  label?: string;
  className?: string;
  /** Light styles for dark surfaces such as the landing page. */
  invert?: boolean;
};

/**
 * Hierarchical back control — always navigates to the parent route.
 */
export function BackButton({
  href,
  label = "Go back",
  className = "",
  invert = false,
}: BackButtonProps) {
  const tone = invert
    ? "border-[#f3efe6]/35 bg-transparent text-[#f3efe6] hover:border-[#f3efe6] hover:bg-[#f3efe6]/10"
    : "border-border bg-surface text-ink hover:border-primary hover:text-primary";

  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={`focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${tone} ${className}`}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M9.5 3.5 5 8l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Back</span>
    </Link>
  );
}
