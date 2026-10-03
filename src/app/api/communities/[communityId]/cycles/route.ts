import { z } from "zod";
import { getOpenCycle } from "@/lib/community";
import { mapDomainError } from "@/server/auth/map-domain-error";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  closeFinancialCycle,
  createFinancialCycle,
} from "@/server/services/communities";

type RouteContext = { params: Promise<{ communityId: string }> };

const createSchema = z.object({
  name: z.string().min(1).max(80),
  endsAt: z.string().min(1),
});

function endOfLocalDay(dateInput: string): Date {
  // dateInput is YYYY-MM-DD from <input type="date">
  const d = new Date(`${dateInput}T23:59:59`);
  return d;
}

export async function POST(request: Request, context: RouteContext) {
  const { communityId } = await context.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const access = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in access) return access.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Name and end date are required.");
  }

  const endsAt = endOfLocalDay(parsed.data.endsAt);
  if (Number.isNaN(endsAt.getTime())) {
    return apiError(400, "VALIDATION_ERROR", "Invalid cycle end date.");
  }

  try {
    const cycle = await createFinancialCycle({
      communityId,
      name: parsed.data.name,
      endsAt,
      actorMembershipId: access.membership.id,
    });
    return Response.json({ cycle }, { status: 201 });
  } catch (error) {
    return mapDomainError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { communityId } = await context.params;
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const access = await requireCommunityCoordinator(communityId, auth.user.id);
  if ("error" in access) return access.error;

  const cycle = await getOpenCycle(communityId);
  if (!cycle) {
    return apiError(422, "PRECONDITION_FAILED", "Open cycle required.");
  }

  const parsed = z
    .object({
      action: z.literal("close"),
      acknowledgeOutstandingBalances: z.boolean().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "action close is required.");
  }

  try {
    const closed = await closeFinancialCycle({
      communityId,
      cycleId: cycle.id,
      actorMembershipId: access.membership.id,
      acknowledgeOutstandingBalances: parsed.data.acknowledgeOutstandingBalances,
    });
    return Response.json({ cycle: closed });
  } catch (error) {
    return mapDomainError(error);
  }
}
