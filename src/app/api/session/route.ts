import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainError } from "@/server/services/communities";
import {
  loginAsDemoUser,
  loginWithPassword,
  registerAccount,
} from "@/server/services/auth";
import {
  clearSession,
  safeNextPath,
  setSessionUser,
} from "@/server/auth/current-user";

const passwordLoginSchema = z.object({
  action: z.literal("password"),
  username: z.string().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

const demoLoginSchema = z.object({
  action: z.literal("demo").optional(),
  userId: z.string().min(1),
  next: z.string().optional(),
});

const registerSchema = z.object({
  action: z.literal("register"),
  username: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().min(1),
  next: z.string().optional(),
});

function mapErr(err: unknown) {
  if (err instanceof DomainError) {
    const status =
      err.code === "UNAUTHORIZED" || err.code === "FORBIDDEN"
        ? 401
        : err.code === "USER_NOT_FOUND"
          ? 404
          : err.code === "CONFLICT"
            ? 409
            : 400;
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status },
    );
  }
  console.error(err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Unexpected server error." } },
    { status: 500 },
  );
}

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

  const asRecord = body as { action?: string };

  try {
    if (asRecord.action === "register") {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "username, password, and displayName are required.",
            },
          },
          { status: 400 },
        );
      }
      const user = await registerAccount(parsed.data);
      await setSessionUser(user.id);
      return NextResponse.json({
        user,
        next: safeNextPath(parsed.data.next),
      });
    }

    if (asRecord.action === "password") {
      const parsed = passwordLoginSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "username and password are required.",
            },
          },
          { status: 400 },
        );
      }
      const user = await loginWithPassword(parsed.data);
      await setSessionUser(user.id);
      return NextResponse.json({
        user,
        next: safeNextPath(parsed.data.next),
      });
    }

    // Demo picker (userId) — action optional for backwards compatibility
    const parsed = demoLoginSchema.safeParse({
      ...(typeof body === "object" && body ? body : {}),
      action: "demo",
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Provide password login, demo userId, or register.",
          },
        },
        { status: 400 },
      );
    }

    const user = await loginAsDemoUser(parsed.data.userId);
    await setSessionUser(user.id);
    return NextResponse.json({
      user,
      next: safeNextPath(parsed.data.next),
    });
  } catch (err) {
    return mapErr(err);
  }
}

export async function DELETE() {
  await clearSession();
  return NextResponse.json({ ok: true });
}
