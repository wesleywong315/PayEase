-- Add endsAt with backfill for existing cycles
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "endsAt" DATETIME NOT NULL,
    "closedAt" DATETIME,
    "closeAcknowledgedOutstanding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialCycle_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FinancialCycle" (
  "closeAcknowledgedOutstanding",
  "closedAt",
  "communityId",
  "createdAt",
  "id",
  "name",
  "revision",
  "status",
  "endsAt"
)
SELECT
  "closeAcknowledgedOutstanding",
  "closedAt",
  "communityId",
  "createdAt",
  "id",
  "name",
  "revision",
  "status",
  '2026-12-31T23:59:59.000Z'
FROM "FinancialCycle";
DROP TABLE "FinancialCycle";
ALTER TABLE "new_FinancialCycle" RENAME TO "FinancialCycle";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
