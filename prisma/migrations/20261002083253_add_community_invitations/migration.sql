-- AlterTable
ALTER TABLE "Community" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "CommunityInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityInvitation_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CommunityInvitation_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvitation_token_key" ON "CommunityInvitation"("token");
