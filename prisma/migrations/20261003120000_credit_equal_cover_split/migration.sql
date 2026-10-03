-- AlterTable
ALTER TABLE "Credit" ADD COLUMN "equalCoverCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Credit" ADD COLUMN "payAidCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Credit" ADD COLUMN "unallocatedRemainderCents" INTEGER NOT NULL DEFAULT 0;

UPDATE "Credit" SET "equalCoverCents" = "amountCents", "payAidCents" = 0, "unallocatedRemainderCents" = 0;

-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN "equalCoverAppliedCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "HardshipFunding" ADD COLUMN "creditId" TEXT;

-- CreateTable
CREATE TABLE "MembershipEqualCover" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "remainingCents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MembershipEqualCover_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipEqualCover_cycleId_membershipId_key" ON "MembershipEqualCover"("cycleId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "HardshipFunding_creditId_key" ON "HardshipFunding"("creditId");

-- AddForeignKey
ALTER TABLE "MembershipEqualCover" ADD CONSTRAINT "MembershipEqualCover_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FinancialCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MembershipEqualCover" ADD CONSTRAINT "MembershipEqualCover_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HardshipFunding" ADD CONSTRAINT "HardshipFunding_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "Credit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
