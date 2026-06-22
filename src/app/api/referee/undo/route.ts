import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { undoLastPoint } from "@/lib/scoringEngine";
import sseBroker from "@/lib/sse";
import prisma from "@/lib/db";
import { EnteredByRole } from "@prisma/client";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const session = token ? await verifyJWT(token) : null;

  if (!session || (session.role !== "REFEREE" && session.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { matchId, gameId } = await request.json();

    if (!matchId || !gameId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Call scoring engine to undo last point
    const state = await undoLastPoint({
      matchId,
      gameId,
      userId: session.id,
      role: session.role === "ADMIN" ? EnteredByRole.ADMIN : EnteredByRole.REFEREE,
    });

    // Fetch tournament ID to broadcast tournament update
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { division: true },
    });

    if (match) {
      // Broadcast update via SSE
      sseBroker.broadcast(`match:${matchId}`, "score_update", state);
      sseBroker.broadcast(`tournament:${match.division.tournamentId}`, "match_update", { matchId });
    }

    return NextResponse.json(state);
  } catch (err: any) {
    console.error("API referee undo error:", err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
