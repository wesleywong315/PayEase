import { NextResponse } from "next/server";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import { archiveCategory } from "@/server/services/expenses";

type RouteCtx = {
  params: Promise<{ communityId: string; categoryId: string }>;
};

export async function POST(_req: Request, ctx: RouteCtx) {
  const { communityId, categoryId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  try {
    const category = await archiveCategory({ communityId, categoryId });
    return NextResponse.json({ category });
  } catch (err) {
    if (err instanceof DomainError) {
      return apiError(err.code === "NOT_FOUND" ? 404 : 400, err.code, err.message);
    }
    console.error(err);
    return apiError(500, "INTERNAL", "Unexpected server error.");
  }
}
