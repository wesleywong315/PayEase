import { z } from "zod";
import {
  apiError,
  requireApiUser,
  requireCommunityCoordinator,
} from "@/server/auth/permissions";
import {
  DomainError,
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
    if (error instanceof DomainError) {
      const status = error.code === "CONFLICT" ? 409 : 400;
      return apiError(status, error.code, error.message, error.details);
    }
    console.error("Create cycle failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not create cycle.");
  }
}
