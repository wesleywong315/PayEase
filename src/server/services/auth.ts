import { DomainError } from "@/server/services/communities";
import { prisma } from "@/lib/db";
import {
  DEMO_PASSWORD,
  hashPassword,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "@/lib/password";
import { DEMO } from "../../../prisma/demo-ids";

export { DEMO_PASSWORD };

const DEMO_USER_IDS: ReadonlySet<string> = new Set(
  Object.values(DEMO.users).map((u) => u.id),
);

export async function loginWithPassword(input: {
  username: string;
  password: string;
}) {
  const usernameError = validateUsername(input.username);
  if (usernameError) {
    throw new DomainError("VALIDATION_ERROR", usernameError);
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new DomainError("VALIDATION_ERROR", passwordError);
  }

  const username = normalizeUsername(input.username);
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, displayName: true, passwordHash: true },
  });

  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new DomainError("UNAUTHORIZED", "Invalid username or password.");
  }

  return { id: user.id, displayName: user.displayName };
}

export async function loginAsDemoUser(userId: string) {
  if (!DEMO_USER_IDS.has(userId)) {
    throw new DomainError(
      "FORBIDDEN",
      "Only seeded demo accounts can be opened from Demo accounts.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayName: true },
  });
  if (!user) {
    throw new DomainError("USER_NOT_FOUND", "Demo user not found.");
  }
  return user;
}

export async function registerAccount(input: {
  username: string;
  password: string;
  displayName: string;
}) {
  const usernameError = validateUsername(input.username);
  if (usernameError) {
    throw new DomainError("VALIDATION_ERROR", usernameError);
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new DomainError("VALIDATION_ERROR", passwordError);
  }

  const displayName = input.displayName.trim();
  if (displayName.length < 2 || displayName.length > 60) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Display name must be 2–60 characters.",
    );
  }

  const username = normalizeUsername(input.username);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new DomainError("CONFLICT", "That username is already taken.");
  }

  const user = await prisma.user.create({
    data: {
      username,
      displayName,
      passwordHash: hashPassword(input.password),
      email: null,
    },
    select: { id: true, displayName: true, username: true },
  });

  return user;
}
