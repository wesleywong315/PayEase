"use client";

import { useState } from "react";
import { MoneyText } from "@/components/MoneyText";

export type ReceivableMember = {
  membershipId: string;
  displayName: string;
  email: string | null;
  role: "COORDINATOR" | "MEMBER";
  contributionOutstandingCents: number;
  reimbursementOutstandingCents: number;
  refundDueCents: number;
  unusedEqualCoverCents: number;
  charges: Array<{
    expenseId: string;
    title: string;
    category: string;
    dueAt: string | null;
    finalChargeCents: number;
    paidCents: number;
    outstandingCents: number;
  }>;
};

type Props = {
  members: ReceivableMember[];
};

export function CoordinatorReceivablesPanel({ members }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <p className="type-caption rounded-xl border border-border bg-surface px-3 py-2">
        No participants yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {members.map((member) => {
        const expanded = openId === member.membershipId;
        const owes = member.contributionOutstandingCents;
        const isCoordinator = member.role === "COORDINATOR";

        return (
          <li key={member.membershipId}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() =>
                setOpenId(expanded ? null : member.membershipId)
              }
              className="focus-ring flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-canvas/80"
            >
              <p
                className={`min-w-0 truncate text-sm text-ink ${
                  isCoordinator ? "font-bold" : "font-medium"
                }`}
              >
                {member.displayName}
              </p>
              <span className="shrink-0 text-sm tabular-nums">
                <MoneyText
                  cents={owes}
                  className={
                    owes > 0
                      ? "font-semibold text-danger"
                      : "text-muted"
                  }
                />
              </span>
            </button>

            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                {expanded ? (
                  <div className="space-y-2 border-t border-border bg-canvas/60 px-3 py-2">
                    {member.unusedEqualCoverCents > 0 ? (
                      <p className="type-caption">
                        Unused equal-cover credit{" "}
                        <MoneyText
                          cents={member.unusedEqualCoverCents}
                          className="inline font-semibold text-ink"
                        />
                        . Applies when this member has committed charges.
                      </p>
                    ) : null}
                    {member.charges.length === 0 ? (
                      <p className="type-caption">
                        No committed charges in this cycle.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
                        {member.charges.map((line) => (
                          <li
                            key={line.expenseId}
                            className="flex items-start justify-between gap-3 px-2.5 py-1.5 text-sm"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {line.title}
                              </p>
                              <p className="type-caption">
                                Paid{" "}
                                <MoneyText
                                  cents={line.paidCents}
                                  className="inline"
                                />
                                {" · Left "}
                                <MoneyText
                                  cents={line.outstandingCents}
                                  className="inline"
                                />
                              </p>
                            </div>
                            <MoneyText
                              cents={line.finalChargeCents}
                              className="shrink-0 font-semibold"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
