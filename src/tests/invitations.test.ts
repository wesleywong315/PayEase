import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => {
  const membershipStore = new Map<string, Record<string, unknown>>();
  const inviteStore = new Map<string, Record<string, unknown>>();

  const tx = {
    communityInvitation: {
      findUnique: async ({ where }: { where: { token: string } }) =>
        inviteStore.get(where.token) ?? null,
    },
    membership: {
      findUnique: async ({
        where,
      }: {
        where: { communityId_userId: { communityId: string; userId: string } };
      }) => {
        const key = `${where.communityId_userId.communityId}:${where.communityId_userId.userId}`;
        return membershipStore.get(key) ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `mem_${randomBytes(4).toString("hex")}`, ...data };
        membershipStore.set(`${data.communityId}:${data.userId}`, row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        for (const [key, value] of membershipStore) {
          if (value.id === where.id) {
            const next = { ...value, ...data };
            membershipStore.set(key, next);
            return next;
          }
        }
        throw new Error("membership missing");
      },
    },
    financialCycle: {
      findFirst: async () => null,
    },
    ruleVersion: {
      findFirst: async () => null,
    },
    ruleAcceptance: {
      upsert: async () => ({}),
    },
    auditEvent: {
      create: async () => ({}),
    },
  };

  return {
    prisma: {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
      communityInvitation: {
        findUnique: async ({ where }: { where: { token: string } }) =>
          inviteStore.get(where.token) ?? null,
      },
      financialCycle: {
        findFirst: async () => null,
      },
      ruleVersion: {
        findFirst: async () => null,
      },
      __stores: { membershipStore, inviteStore },
    },
  };
});

import { prisma } from "@/lib/db";
import {
  DomainError,
  confirmJoinInvitation,
  createOpaqueInviteToken,
  getInvitationPreview,
  invitationStatus,
} from "@/server/services/communities";

type Stores = {
  membershipStore: Map<string, Record<string, unknown>>;
  inviteStore: Map<string, Record<string, unknown>>;
};

function stores(): Stores {
  return (prisma as unknown as { __stores: Stores }).__stores;
}

describe("invitation helpers", () => {
  beforeEach(() => {
    stores().membershipStore.clear();
    stores().inviteStore.clear();
  });

  it("creates opaque tokens", () => {
    const a = createOpaqueInviteToken();
    const b = createOpaqueInviteToken();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("classifies invitation status", () => {
    expect(
      invitationStatus({
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
      }),
    ).toBe("ACTIVE");
    expect(
      invitationStatus({
        expiresAt: new Date(Date.now() - 60_000),
        revokedAt: null,
      }),
    ).toBe("EXPIRED");
    expect(
      invitationStatus({
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      }),
    ).toBe("REVOKED");
  });

  it("rejects expired invitation previews", async () => {
    stores().inviteStore.set("tok_expired", {
      token: "tok_expired",
      communityId: "c1",
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
      community: { id: "c1", name: "Test", description: null },
      createdBy: { user: { displayName: "Alex" } },
    });

    await expect(getInvitationPreview("tok_expired")).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it("joins as MEMBER and is idempotent for active members", async () => {
    stores().inviteStore.set("tok_ok", {
      token: "tok_ok",
      communityId: "c1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      community: { id: "c1", name: "Volleyball", description: "Hall team" },
      id: "inv1",
    });

    const first = await confirmJoinInvitation({
      token: "tok_ok",
      userId: "user_x",
    });
    expect(first.alreadyMember).toBe(false);
    expect(first.membership.role).toBe("MEMBER");

    const second = await confirmJoinInvitation({
      token: "tok_ok",
      userId: "user_x",
    });
    expect(second.alreadyMember).toBe(true);
    expect(second.membership.id).toBe(first.membership.id);
  });

  it("rejoins departed members without creating a new membership id", async () => {
    stores().inviteStore.set("tok_rejoin", {
      token: "tok_rejoin",
      communityId: "c1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      community: { id: "c1", name: "Swim", description: null },
      id: "inv2",
    });
    stores().membershipStore.set("c1:user_y", {
      id: "mem_existing",
      communityId: "c1",
      userId: "user_y",
      role: "COORDINATOR",
      status: "LEFT",
      leftAt: new Date(),
    });

    const result = await confirmJoinInvitation({
      token: "tok_rejoin",
      userId: "user_y",
    });

    expect(result.alreadyMember).toBe(false);
    expect(result.membership.id).toBe("mem_existing");
    expect(result.membership.role).toBe("MEMBER");
    expect(result.membership.status).toBe("ACTIVE");
  });

  it("never grants coordinator via invitation token", async () => {
    stores().inviteStore.set("tok_member_only", {
      token: "tok_member_only",
      communityId: "c2",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      community: { id: "c2", name: "New", description: null },
      id: "inv3",
    });

    const result = await confirmJoinInvitation({
      token: "tok_member_only",
      userId: "user_z",
    });
    expect(result.membership.role).toBe("MEMBER");
  });
});
