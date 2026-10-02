import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    await prisma.community.findFirst({
      select: { id: true },
    });

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Health check database query failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        message: "Service temporarily unavailable",
      },
      { status: 503 },
    );
  }
}
