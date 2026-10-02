import { randomBytes } from "node:crypto";
import { MembershipRole, MembershipStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const INVITATION_DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function createOpaqueInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function invitationStatus(invite: {
  expiresAt: Date;
  revokedAt: Date | null;
}): "ACTIVE" | "EXPIRED" | "REVOKED" {
  if (invite.revokedAt) return "REVOKED";
  if (invite.expiresAt.getTime() <= Date.now()) return "EXPIRED";
  return "ACTIVE";
}

export class DomainError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export async function createCommunityForUser(input: {
  userId: string;
  name: string;
  description?: string | null;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Community name must be between 2 and 80 characters.",
    );
  }

  const description = input.description?.trim() || null;
  if (description && description.length > 500) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Description must be at most 500 characters.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const community = await tx.community.create({
      data: {
        name,
        description,
      },
    });

    const membership = await tx.membership.create({
      data: {
        communityId: community.id,
        userId: input.userId,
        role: MembershipRole.COORDINATOR,
        status: MembershipStatus.ACTIVE,
      },
    });

    await tx.auditEvent.create({
      data: {
        communityId: community.id,
        actorMembershipId: membership.id,
        action: "COMMUNITY_CREATED",
        entityType: "Community",
        entityId: community.id,
        payloadJson: JSON.stringify({ name, description }),
      },
    });

    return { community, membership };
  });
}

export async function createCommunityInvitation(input: {
  communityId: string;
  actorMembershipId: string;
  ttlMs?: number;
}) {
  const expiresAt = new Date(
    Date.now() + (input.ttlMs ?? INVITATION_DEFAULT_TTL_MS),
  );
  const token = createOpaqueInviteToken();

  const invitation = await prisma.communityInvitation.create({
    data: {
      communityId: input.communityId,
      token,
      createdByMembershipId: input.actorMembershipId,
      expiresAt,
    },
  });

  await prisma.auditEvent.create({
    data: {
      communityId: input.communityId,
      actorMembershipId: input.actorMembershipId,
      action: "INVITATION_CREATED",
      entityType: "CommunityInvitation",
      entityId: invitation.id,
      payloadJson: JSON.stringify({ expiresAt: expiresAt.toISOString() }),
    },
  });

  return invitation;
}

export async function revokeCommunityInvitation(input: {
  invitationId: string;
  communityId: string;
  actorMembershipId: string;
}) {
  const invitation = await prisma.communityInvitation.findFirst({
    where: {
      id: input.invitationId,
      communityId: input.communityId,
    },
  });

  if (!invitation) {
    throw new DomainError("NOT_FOUND", "Invitation not found.");
  }

  if (invitation.revokedAt) {
    return invitation;
  }

  const updated = await prisma.communityInvitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });

  await prisma.auditEvent.create({
    data: {
      communityId: input.communityId,
      actorMembershipId: input.actorMembershipId,
      action: "INVITATION_REVOKED",
      entityType: "CommunityInvitation",
      entityId: invitation.id,
      payloadJson: "{}",
    },
  });

  return updated;
}

/** Public-safe preview — no financial fields. */
export async function getInvitationPreview(token: string) {
  const invitation = await prisma.communityInvitation.findUnique({
    where: { token },
    include: {
      community: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      createdBy: {
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  if (!invitation) {
    throw new DomainError("INVITATION_NOT_FOUND", "Invitation not found.");
  }

  const status = invitationStatus(invitation);
  if (status === "REVOKED") {
    throw new DomainError(
      "INVITATION_REVOKED",
      "This invitation has been revoked. Ask a coordinator for a new link.",
    );
  }
  if (status === "EXPIRED") {
    throw new DomainError(
      "INVITATION_EXPIRED",
      "This invitation has expired. Ask a coordinator for a new link.",
    );
  }

  return {
    token: invitation.token,
    expiresAt: invitation.expiresAt,
    status,
    community: invitation.community,
    coordinatorName: invitation.createdBy.user.displayName,
    roleGranted: "MEMBER" as const,
  };
}

export async function confirmJoinInvitation(input: {
  token: string;
  userId: string;
}) {
  return prisma.$transaction(async (tx) => {
    const invitation = await tx.communityInvitation.findUnique({
      where: { token: input.token },
      include: {
        community: { select: { id: true, name: true, description: true } },
      },
    });

    if (!invitation) {
      throw new DomainError("INVITATION_NOT_FOUND", "Invitation not found.");
    }

    const status = invitationStatus(invitation);
    if (status === "REVOKED") {
      throw new DomainError(
        "INVITATION_REVOKED",
        "This invitation has been revoked. Ask a coordinator for a new link.",
      );
    }
    if (status === "EXPIRED") {
      throw new DomainError(
        "INVITATION_EXPIRED",
        "This invitation has expired. Ask a coordinator for a new link.",
      );
    }

    const existing = await tx.membership.findUnique({
      where: {
        communityId_userId: {
          communityId: invitation.communityId,
          userId: input.userId,
        },
      },
    });

    if (existing?.status === MembershipStatus.ACTIVE) {
      return {
        alreadyMember: true as const,
        membership: existing,
        community: invitation.community,
      };
    }

    let membership;
    if (existing) {
      // Rejoin: restore ACTIVE without erasing historical liabilities.
      // Invite always grants MEMBER (no coordinator escalation via URL).
      membership = await tx.membership.update({
        where: { id: existing.id },
        data: {
          status: MembershipStatus.ACTIVE,
          role: MembershipRole.MEMBER,
          leftAt: null,
          joinedAt: new Date(),
        },
      });
    } else {
      membership = await tx.membership.create({
        data: {
          communityId: invitation.communityId,
          userId: input.userId,
          role: MembershipRole.MEMBER,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    await tx.auditEvent.create({
      data: {
        communityId: invitation.communityId,
        actorMembershipId: membership.id,
        action: "MEMBER_JOINED_VIA_INVITE",
        entityType: "Membership",
        entityId: membership.id,
        payloadJson: JSON.stringify({
          invitationId: invitation.id,
          rejoined: Boolean(existing),
        }),
      },
    });

    return {
      alreadyMember: false as const,
      membership,
      community: invitation.community,
    };
  });
}

export async function createFinancialCycle(input: {
  communityId: string;
  name: string;
  actorMembershipId: string;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Cycle name must be between 2 and 80 characters.",
    );
  }

  const cycle = await prisma.financialCycle.create({
    data: {
      communityId: input.communityId,
      name,
      status: "OPEN",
      revision: 1,
    },
  });

  await prisma.auditEvent.create({
    data: {
      communityId: input.communityId,
      cycleId: cycle.id,
      actorMembershipId: input.actorMembershipId,
      action: "CYCLE_CREATED",
      entityType: "FinancialCycle",
      entityId: cycle.id,
      payloadJson: JSON.stringify({ name }),
    },
  });

  return cycle;
}
