import { getCurrentCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityMember,
} from "@/server/auth/permissions";
import {
  getSettlementRows,
  settlementRowsToCsv,
} from "@/server/services/reports";

type RouteCtx = { params: Promise<{ communityId: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const cycle = await getCurrentCycle(communityId);
  if (!cycle) {
    return apiError(422, "PRECONDITION_FAILED", "No cycle to export.");
  }

  try {
    const { rows, treasurerCashCents } = await getSettlementRows({
      communityId,
      cycleId: cycle.id,
      viewerMembershipId: member.membership.id,
      isCoordinator: member.membership.role === "COORDINATOR",
    });
    const csv = settlementRowsToCsv(rows, treasurerCashCents);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payease-${cycle.name.replaceAll(/[^\w-]+/g, "-")}.csv"`,
      },
    });
  } catch (err) {
    return mapDomainError(err);
  }
}
