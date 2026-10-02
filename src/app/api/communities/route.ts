import { z } from "zod";
import { apiError, requireApiUser } from "@/server/auth/permissions";
import {
  DomainError,
  createCommunityForUser,
} from "@/server/services/communities";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "Invalid JSON body.");
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "VALIDATION_ERROR", "Invalid community fields.");
  }

  try {
    const result = await createCommunityForUser({
      userId: auth.user.id,
      name: parsed.data.name,
      description: parsed.data.description,
    });

    return Response.json(
      {
        community: result.community,
        membership: {
          id: result.membership.id,
          role: result.membership.role,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof DomainError) {
      return apiError(400, error.code, error.message, error.details);
    }
    console.error("Create community failed:", error);
    return apiError(500, "INTERNAL_ERROR", "Could not create community.");
  }
}
