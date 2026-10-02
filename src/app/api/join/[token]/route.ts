import { getSessionUser } from "@/server/auth/current-user";
import { apiError } from "@/server/auth/permissions";
import {
  DomainError,
  confirmJoinInvitation,
  getInvitationPreview,
} from "@/server/services/communities";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    const preview = await getInvitationPreview(token);
    const user = await getSessionUser();
    let viewer: {
      signedIn: boolean;
      alreadyMember: boolean;
      membershipId?: string;
    } = { signedIn: false, alreadyMember: false };

    if (user) {
      const membership = await prisma.membership.findUnique({
        where: {
          communityId_userId: {
            communityId: preview.community.id,
            userId: user.id,
          },
        },
      });
      viewer = {
        signedIn: true,
        alreadyMember: membership?.status === "ACTIVE",
        membershipId: membership?.id,
      };
    }

    return Response.json({ preview, viewer });
  } catch (error) {
    if (error instanceof DomainError) {
      const status =
        error.code === "INVITATION_NOT_FOUND"
          ? 404
          : error.code === "INVITATION_REVOKED" ||
              error.code === "INVITATION_EXPIRED"
            ? 410
            : 400;
      return apiError(status, error.code, error.message, error.details);
    }
    console.error("Invitation preview failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not load invitation.");
  }
}

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const user = await getSessionUser();
  if (!user) {
    return apiError(401, "UNAUTHORIZED", "Sign in required to join.");
  }

  try {
    const result = await confirmJoinInvitation({
      token,
      userId: user.id,
    });

    return Response.json({
      alreadyMember: result.alreadyMember,
      community: result.community,
      membership: {
        id: result.membership.id,
        role: result.membership.role,
        status: result.membership.status,
      },
    });
  } catch (error) {
    if (error instanceof DomainError) {
      const status =
        error.code === "INVITATION_NOT_FOUND"
          ? 404
          : error.code === "INVITATION_REVOKED" ||
              error.code === "INVITATION_EXPIRED"
            ? 410
            : 400;
      return apiError(status, error.code, error.message, error.details);
    }
    console.error("Join confirmation failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not join community.");
  }
}
