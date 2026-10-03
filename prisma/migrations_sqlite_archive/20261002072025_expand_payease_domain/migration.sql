-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "Membership_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FinancialCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "closedAt" DATETIME,
    "closeAcknowledgedOutstanding" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialCycle_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "equalShareFallbackWhenZeroUsage" BOOLEAN NOT NULL DEFAULT true,
    "requiredAcceptorIdsJson" TEXT NOT NULL DEFAULT '[]',
    "createdByMembershipId" TEXT NOT NULL,
    "proposedAt" DATETIME,
    "acceptedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleVersion_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersion_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleVersion_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RuleAcceptance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ruleVersionId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "acceptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RuleAcceptance_ruleVersionId_fkey" FOREIGN KEY ("ruleVersionId") REFERENCES "RuleVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RuleAcceptance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "ruleVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fixedCents" INTEGER NOT NULL,
    "variableCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "usageLabel" TEXT NOT NULL,
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
    CONSTRAINT "Expense_frontedByMembershipId_fkey" FOREIGN KEY ("frontedByMembershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExpenseParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "usageUnits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ExpenseParticipant_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExpenseParticipant_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expenseId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "fixedShareCents" INTEGER NOT NULL,
    "usageShareCents" INTEGER NOT NULL,
    "baselineCents" INTEGER NOT NULL,
    "hardshipAppliedCents" INTEGER NOT NULL DEFAULT 0,
    "finalChargeCents" INTEGER NOT NULL,
    CONSTRAINT "Allocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Allocation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContributionCapRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "requestedCapCents" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "decidedByMembershipId" TEXT,
    "decidedAt" DATETIME,
    "rejectionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContributionCapRequest_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContributionCapRequest_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContributionCapRequest_decidedByMembershipId_fkey" FOREIGN KEY ("decidedByMembershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HardshipFunding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "recordedByMembershipId" TEXT NOT NULL,
    "cashTransactionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HardshipFunding_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HardshipFunding_recordedByMembershipId_fkey" FOREIGN KEY ("recordedByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HardshipFunding_cashTransactionId_fkey" FOREIGN KEY ("cashTransactionId") REFERENCES "CashTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HardshipAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "capRequestId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "approvedByMembershipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HardshipAward_capRequestId_fkey" FOREIGN KEY ("capRequestId") REFERENCES "ContributionCapRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HardshipAward_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HardshipAward_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HardshipAward_approvedByMembershipId_fkey" FOREIGN KEY ("approvedByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "membershipId" TEXT,
    "expenseId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "note" TEXT,
    "manuallyConfirmed" BOOLEAN NOT NULL DEFAULT true,
    "recordedByMembershipId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTransaction_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "CashTransaction_recordedByMembershipId_fkey" FOREIGN KEY ("recordedByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Withdrawal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cycleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "executedByMembershipId" TEXT NOT NULL,
    "previewSnapshotJson" TEXT NOT NULL,
    "executedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Withdrawal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Withdrawal_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Withdrawal_executedByMembershipId_fkey" FOREIGN KEY ("executedByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "cycleId" TEXT,
    "actorMembershipId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_actorMembershipId_fkey" FOREIGN KEY ("actorMembershipId") REFERENCES "Membership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Membership_communityId_userId_key" ON "Membership"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RuleVersion_cycleId_versionNumber_key" ON "RuleVersion"("cycleId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "RuleAcceptance_ruleVersionId_membershipId_key" ON "RuleAcceptance"("ruleVersionId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseParticipant_expenseId_membershipId_key" ON "ExpenseParticipant"("expenseId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "Allocation_expenseId_membershipId_key" ON "Allocation"("expenseId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "HardshipFunding_cashTransactionId_key" ON "HardshipFunding"("cashTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "HardshipAward_capRequestId_key" ON "HardshipAward"("capRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "CashTransaction_cycleId_idempotencyKey_key" ON "CashTransaction"("cycleId", "idempotencyKey");
