import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  DomainError,
  createCommunityInvitation,
  invitationStatus,
} from "@/server/services/communities";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ communityId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { communityId } = await context.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const access = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in access) return access.error;

  const invitations = await prisma.communityInvitation.findMany({
    where: { communityId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return Response.json({
    invitations: invitations.map((invite) => ({
      id: invite.id,
      token: invite.token,
      expiresAt: invite.expiresAt,
      revokedAt: invite.revokedAt,
      createdAt: invite.createdAt,
      status: invitationStatus(invite),
      path: `/join/${invite.token}`,
    })),
  });
}

const createSchema = z.object({
  ttlDays: z.number().int().min(1).max(30).optional(),
});

export async function POST(request: Request, context: RouteContext) {
  const { communityId } = await context.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const access = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in access) return access.error;

  let body: unknown = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      body = await request.json();
    }
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid invitation fields.");
  }

  try {
    const ttlMs = (parsed.data.ttlDays ?? 7) * 24 * 60 * 60 * 1000;
    const invitation = await createCommunityInvitation({
      communityId,
      actorMembershipId: access.membership.id,
      ttlMs,
    });

    return Response.json(
      {
        invitation: {
          id: invitation.id,
          token: invitation.token,
          expiresAt: invitation.expiresAt,
          status: invitationStatus(invitation),
          path: `/join/${invitation.token}`,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(400, error.code, error.message, error.details);
    }
    console.error("Create invitation failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not create invitation.");
  }
}
