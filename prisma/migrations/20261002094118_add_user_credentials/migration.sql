-- Add credentials with backfill for existing demo users
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "displayName", "email", "id", "username", "passwordHash")
SELECT
  "createdAt",
  "displayName",
  "email",
  "id",
  CASE "id"
    WHEN 'user_alex' THEN 'alex'
    WHEN 'user_ben' THEN 'ben'
    WHEN 'user_chloe' THEN 'chloe'
    WHEN 'user_dana' THEN 'dana'
    ELSE lower(replace("id", 'user_', ''))
  END,
  -- Placeholder; seed replaces with a real scrypt hash for DEMO_PASSWORD
  'pending:rehash'
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
