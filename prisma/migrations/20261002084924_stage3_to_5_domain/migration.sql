-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Category_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "expenseId" TEXT,
    "membershipId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "note" TEXT,
    "expectedOutstandingCents" INTEGER NOT NULL,
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "decidedByMembershipId" TEXT,
    "rejectionReason" TEXT,
    "cashTransactionId" TEXT,
    CONSTRAINT "PaymentSubmission_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_decidedByMembershipId_fkey" FOREIGN KEY ("decidedByMembershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentSubmission_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityNotification_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityNotificationRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityNotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "CommunityNotification" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommunityNotificationRead_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "ruleVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "categoryId" TEXT,
    "isOneTimeCategory" BOOLEAN NOT NULL DEFAULT false,
    "fixedCents" INTEGER NOT NULL,
    "variableCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "usageLabel" TEXT NOT NULL,
    "dueAt" DATETIME,
    "frontedByMembershipId" TEXT,
    "needsRevision" BOOLEAN NOT NULL DEFAULT false,
    "committedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_frontedByMembershipId_fkey" FOREIGN KEY ("frontedByMembershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("cancelledAt", "category", "committedAt", "communityId", "createdAt", "createdByMembershipId", "cycleId", "fixedCents", "frontedByMembershipId", "id", "needsRevision", "ruleVersionId", "status", "title", "totalCents", "updatedAt", "usageLabel", "variableCents") SELECT "cancelledAt", "category", "committedAt", "communityId", "createdAt", "createdByMembershipId", "cycleId", "fixedCents", "frontedByMembershipId", "id", "needsRevision", "ruleVersionId", "status", "title", "totalCents", "updatedAt", "usageLabel", "variableCents" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE TABLE "new_RuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "equalShareFallbackWhenZeroUsage" BOOLEAN NOT NULL DEFAULT true,
    "featureTogglesJson" TEXT NOT NULL DEFAULT '{}',
    "cycleBudgetCapCents" INTEGER,
    "requiredAcceptorIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdByMembershipId" TEXT NOT NULL,
    "proposedAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVersion_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersion_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RuleVersion" ("acceptedAt", "bodyMarkdown", "communityId", "createdAt", "createdByMembershipId", "cycleId", "equalShareFallbackWhenZeroUsage", "id", "proposedAt", "requiredAcceptorIdsJson", "status", "title", "versionNumber") SELECT "acceptedAt", "bodyMarkdown", "communityId", "createdAt", "createdByMembershipId", "cycleId", "equalShareFallbackWhenZeroUsage", "id", "proposedAt", "requiredAcceptorIdsJson", "status", "title", "versionNumber" FROM "RuleVersion";
DROP TABLE "RuleVersion";
ALTER TABLE "new_RuleVersion" RENAME TO "RuleVersion";
CREATE UNIQUE INDEX "RuleVersion_cycleId_versionNumber_key" ON "RuleVersion"("cycleId", "versionNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Category_communityId_name_key" ON "Category"("communityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSubmission_cashTransactionId_key" ON "PaymentSubmission"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityNotificationRead_notificationId_membershipId_key" ON "CommunityNotificationRead"("notificationId", "membershipId");
