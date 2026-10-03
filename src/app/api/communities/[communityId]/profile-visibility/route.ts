import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityMember,
} from "@/server/auth/permissions";
import { prisma } from "@/lib/db";

type RouteCtx = { params: Promise<{ communityId: string }> };

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { communityId } = await ctx.params;
    const auth = await requireApiUser();
    if ("error" in auth) return auth.error;
    const member = await requireCommunityMember(communityId, auth.user.id);
    if ("error" in member) return member.error;

    const parsed = z
      .object({
        hidden: z.boolean(),
      })
      .safeParse(await req.json().catch(() => null));

    if (!parsed.success) {
      return apiError(400, "VALIDATION_ERROR", "Provide hidden: true or false.");
    }

    const membership = await prisma.membership.update({
      where: { id: member.membership.id },
      data: { hiddenFromProfile: parsed.data.hidden },
      select: {
        id: true,
        communityId: true,
        hiddenFromProfile: true,
      },
    });

    return NextResponse.json({ membership });
  } catch (error) {
    console.error("profile-visibility failed", error);
    return apiError(
      500,
      "INTERNAL_ERROR",
      "Could not update community visibility.",
    );
  }
}
