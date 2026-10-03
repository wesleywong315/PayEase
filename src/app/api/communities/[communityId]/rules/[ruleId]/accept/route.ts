import { NextResponse } from "next/server";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { acceptProposedRule } from "@/server/services/expenses";

type RouteCtx = {
  params: Promise<{ communityId: string; ruleId: string }>;
};

export async function POST(_req: Request, ctx: RouteCtx) {
  const { communityId, ruleId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  try {
    const rule = await acceptProposedRule({
      communityId,
      ruleId,
      membershipId: member.membership.id,
    });
    return NextResponse.json({ rule });
  } catch (err) {
    return mapDomainError(err);
  }
}
