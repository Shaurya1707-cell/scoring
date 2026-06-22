import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import PublicScorecardClient from "./PublicScorecardClient";

export const dynamic = "force-dynamic";

export default async function PublicMatchPage({
  params
}: {
  params: Promise<{ matchId: string }>
}) {
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
    redirect("/");
  }

  // Check if doubles
  const teamAPlayers = await prisma.teamPlayer.count({
    where: { teamId: match.teamAId }
  });
  const isDoubles = teamAPlayers > 1;

  // Format date/times for serialization
  const serializedMatch = {
    ...match,
    scheduledTime: match.scheduledTime ? new Date(match.scheduledTime).toISOString() : null,
    createdAt: new Date(match.createdAt).toISOString(),
    updatedAt: new Date(match.updatedAt).toISOString(),
    games: match.games.map(g => ({
      ...g,
      createdAt: new Date(g.createdAt).toISOString(),
      updatedAt: new Date(g.updatedAt).toISOString()
    }))
  };

  return (
    <PublicScorecardClient 
      initialMatch={serializedMatch as any} 
      isDoubles={isDoubles} 
    />
  );
}
