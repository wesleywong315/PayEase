import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export async function getCommunityOrNotFound(communityId: string) {
  const community = await prisma.community.findUnique({
    where: { id: communityId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
    },
  });

  if (!community) {
    notFound();
  }

  return community;
}

export async function getOpenCycle(communityId: string) {
  return prisma.financialCycle.findFirst({
    where: { communityId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });
}
