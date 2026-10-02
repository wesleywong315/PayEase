import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  DomainError,
  invitationStatus,
  revokeCommunityInvitation,
} from "@/server/services/communities";

type RouteContext = {
  params: Promise<{ communityId: string; invitationId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { communityId, invitationId } = await context.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const access = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in access) return access.error;

  try {
    const invitation = await revokeCommunityInvitation({
      invitationId,
      communityId,
      actorMembershipId: access.membership.id,
    });

    return Response.json({
      invitation: {
        id: invitation.id,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        revokedAt: invitation.revokedAt,
        status: invitationStatus(invitation),
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return apiError(status, error.code, error.message, error.details);
    }
    console.error("Revoke invitation failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not revoke invitation.");
  }
}
