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
});

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
    return apiError(400, "VALIDATION_ERROR", "Invalid cycle fields.");
  }

  try {
    const cycle = await createFinancialCycle({
      communityId,
      name: parsed.data.name,
      actorMembershipId: access.membership.id,
    });
    return Response.json({ cycle }, { status: 201 });
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(400, error.code, error.message, error.details);
    }
    console.error("Create cycle failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not create cycle.");
  }
}
