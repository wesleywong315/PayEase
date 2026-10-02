import type { ReactNode } from "react";
import { BackButton } from "@/components/BackButton";

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
  /** When false, hides the back control (parent chrome may already provide it). */
  showBack?: boolean;
  /** Parent route in the page hierarchy. */
  backHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  showBack = true,
  backHref = "/",
  backLabel = "Go back",
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      {showBack ? (
        <div>
          <BackButton href={backHref} label={backLabel} />
        </div>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="type-h1">{title}</h1>
          {description ? (
            <p className="type-body max-w-2xl text-muted">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
