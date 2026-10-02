import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { DomainError } from "@/server/services/communities";
import {
  createCategory,
  listCategories,
} from "@/server/services/expenses";

type RouteCtx = { params: Promise<{ communityId: string }> };

function mapDomainError(err: unknown) {
  if (err instanceof DomainError) {
    const status =
      err.code === "NOT_FOUND"
        ? 404
        : err.code === "CONFLICT"
          ? 409
          : 400;
    return apiError(status, err.code, err.message, err.details);
  }
  console.error(err);
  return apiError(500, "INTERNAL", "Unexpected server error.");
}

export async function GET(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const member = await requireCommunityMember(communityId, auth.user.id);
  if ("error" in member) return member.error;

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const categories = await listCategories(communityId, includeArchived);
  return NextResponse.json({ categories });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { communityId } = await ctx.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const coord = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in coord) return coord.error;

  const body = z.object({ name: z.string() }).safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid category payload.");
  }

  try {
    const category = await createCategory({ communityId, name: body.data.name });
    return NextResponse.json({ category }, { status: 201 });
  } catch (err) {
    return mapDomainError(err);
  }
}
