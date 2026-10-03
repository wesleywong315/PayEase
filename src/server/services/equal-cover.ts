import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Apply leftover equal-cover cents to this member's committed charges
 * (oldest first). Remaining unused cover stays on MembershipEqualCover.
 */
export async function applyPendingEqualCover(
  tx: Tx,
  input: { cycleId: string; membershipId: string },
) {
  const balance = await tx.membershipEqualCover.findUnique({
    where: {
      cycleId_membershipId: {
        cycleId: input.cycleId,
        membershipId: input.membershipId,
      },
    },
  });
  if (!balance || balance.remainingCents <= 0) return;

  const allocations = await tx.allocation.findMany({
    where: {
      membershipId: input.membershipId,
      expense: { cycleId: input.cycleId, status: "COMMITTED" },
    },
    include: { expense: { select: { committedAt: true, id: true } } },
  });
  allocations.sort((a, b) => {
    const da = a.expense.committedAt?.getTime() ?? 0;
    const db = b.expense.committedAt?.getTime() ?? 0;
    if (da !== db) return da - db;
    return a.expense.id.localeCompare(b.expense.id);
  });

  let remaining = balance.remainingCents;
  for (const row of allocations) {
    if (remaining <= 0) break;
    const room = row.finalChargeCents;
    if (room <= 0) continue;
    const apply = Math.min(remaining, room);
    await tx.allocation.update({
      where: { id: row.id },
      data: {
        equalCoverAppliedCents: row.equalCoverAppliedCents + apply,
        finalChargeCents: row.finalChargeCents - apply,
      },
    });
    remaining -= apply;
  }

  if (remaining !== balance.remainingCents) {
    await tx.membershipEqualCover.update({
      where: { id: balance.id },
      data: { remainingCents: remaining },
    });
  }
}

export async function creditEqualCoverToActiveMembers(
  tx: Tx,
  input: {
    communityId: string;
    cycleId: string;
    equalCoverCents: number;
  },
): Promise<{ perMemberCents: number; unallocatedRemainderCents: number }> {
  if (input.equalCoverCents <= 0) {
    return { perMemberCents: 0, unallocatedRemainderCents: 0 };
  }

  const members = await tx.membership.findMany({
    where: { communityId: input.communityId, status: "ACTIVE" },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (members.length === 0) {
    return {
      perMemberCents: 0,
      unallocatedRemainderCents: input.equalCoverCents,
    };
  }

  const perMemberCents = Math.floor(input.equalCoverCents / members.length);
  const unallocatedRemainderCents =
    input.equalCoverCents - perMemberCents * members.length;

  for (const member of members) {
    if (perMemberCents > 0) {
      await tx.membershipEqualCover.upsert({
        where: {
          cycleId_membershipId: {
            cycleId: input.cycleId,
            membershipId: member.id,
          },
        },
        create: {
          cycleId: input.cycleId,
          membershipId: member.id,
          remainingCents: perMemberCents,
        },
        update: { remainingCents: { increment: perMemberCents } },
      });
    }
    await applyPendingEqualCover(tx, {
      cycleId: input.cycleId,
      membershipId: member.id,
    });
  }

  return { perMemberCents, unallocatedRemainderCents };
}
