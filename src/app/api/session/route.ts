import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  clearSession,
  safeNextPath,
  setSessionUser,
} from "@/server/auth/current-user";

const loginSchema = z.object({
  userId: z.string().min(1),
  next: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid JSON body.",
        },
      },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "userId is required.",
        },
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, displayName: true },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: "USER_NOT_FOUND",
          message: "Demo user not found.",
        },
      },
      { status: 404 },
    );
  }

  await setSessionUser(user.id);
  const next = safeNextPath(parsed.data.next);

  return NextResponse.json({
    user,
    next,
  });
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
