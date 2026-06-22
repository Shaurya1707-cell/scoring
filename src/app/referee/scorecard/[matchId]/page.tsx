import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ScorecardClient from "./ScorecardClient";
import sseBroker from "@/lib/sse";

export const dynamic = "force-dynamic";

export default async function RefereeScorecardPage({
  params
}: {
  params: Promise<{ matchId: string }>
}) {
  const session = await getSession();
  if (!session || (session.role !== "REFEREE" && session.role !== "ADMIN")) {
    redirect("/login");
  }

  const { matchId } = await params;

  // Fetch match details
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      division: true,
      court: true,
      teamA: true,
      teamB: true,
      games: {
        orderBy: { gameNumber: "asc" }
      }
    }
  });

  if (!match) {
    redirect("/referee");
  }

  // Double check if this match is disputed (locked)
  // If so, redirect back or show error. We'll let the client handle showing the locked status.
  
  // Check if doubles by counting players in team A
  const teamAPlayerCount = await prisma.teamPlayer.count({
    where: { teamId: match.teamAId }
  });
  const isDoubles = teamAPlayerCount > 1;

  let games = match.games;
  let status = match.status;

  if (games.length === 0) {
    // Create the first game
    const firstGame = await prisma.game.create({
      data: {
        matchId: match.id,
        gameNumber: 1,
        teamAScore: 0,
        teamBScore: 0,
        servingTeamId: match.teamAId,
        serverNumber: isDoubles ? 2 : null,
        status: "IN_PROGRESS"
      }
    });

    // Update match status to IN_PROGRESS
    await prisma.match.update({
      where: { id: match.id },
      data: { status: "IN_PROGRESS" }
    });

    games = [firstGame];
    status = "IN_PROGRESS";

    // Broadcast update via SSE
    sseBroker.broadcast(`match:${match.id}`, "status_update", { status: "IN_PROGRESS" });
    sseBroker.broadcast(`tournament:${match.division.tournamentId}`, "match_update", { matchId: match.id });
  }

  // Format date/times for serialization
  const serializedMatch = {
    ...match,
    status,
    scheduledTime: match.scheduledTime ? new Date(match.scheduledTime) : null,
    createdAt: new Date(match.createdAt),
    updatedAt: new Date(match.updatedAt),
    games: games.map(g => ({
      ...g,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt)
    }))
  };

  return (
    <ScorecardClient 
      initialMatch={serializedMatch as any} 
      isDoubles={isDoubles} 
    />
  );
}
