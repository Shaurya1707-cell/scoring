import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  const { matchId } = await params;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        division: true,
        court: true,
        teamA: true,
        teamB: true,
        games: {
          orderBy: { gameNumber: "asc" },
        },
      },
    });

    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    return NextResponse.json(match);
  } catch (err: any) {
    console.error("API get match error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
