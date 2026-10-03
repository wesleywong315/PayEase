import Image from "next/image";

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
  const wordmark = invert ? "#f3efe6" : "#103b2f";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <Image
        src="/payease-mark.png"
        alt={showWordmark ? "" : "PayEase"}
        width={72}
        height={72}
        priority
        className={`object-contain ${markClassName || "h-9 w-9"}`}
        aria-hidden={showWordmark ? true : undefined}
      />
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
