import prisma from "./db";

export async function getDivisionStandings(divisionId: string) {
  const teams = await prisma.team.findMany({
    where: { divisionId },
    include: {
      matchesAsTeamA: { where: { status: "COMPLETED" }, include: { games: true } },
      matchesAsTeamB: { where: { status: "COMPLETED" }, include: { games: true } },
      matchesWon: true,
    },
  });

  const standings = teams.map((team) => {
    const completedMatches = [...team.matchesAsTeamA, ...team.matchesAsTeamB];
    const matchesPlayed = completedMatches.length;
    const wins = team.matchesWon.length;
    const losses = matchesPlayed - wins;

    let gamesWon = 0;
    let gamesLost = 0;
    let pointDiff = 0;

    for (const match of completedMatches) {
      const isTeamA = match.teamAId === team.id;
      for (const game of match.games) {
        if (game.status === "COMPLETED") {
          const scoreUs = isTeamA ? game.teamAScore : game.teamBScore;
          const scoreThem = isTeamA ? game.teamBScore : game.teamAScore;

          if (scoreUs > scoreThem) {
            gamesWon++;
          } else {
            gamesLost++;
          }
          pointDiff += scoreUs - scoreThem;
        }
      }
    }

    return {
      id: team.id,
      name: team.name || "Unnamed Team",
      matchesPlayed,
      wins,
      losses,
      gamesWon,
      gamesLost,
      pointDiff,
    };
  });

  // Sort by Wins desc, Game win ratio desc, Point Diff desc
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    const aRatio = a.gamesWon / (a.gamesWon + a.gamesLost || 1);
    const bRatio = b.gamesWon / (b.gamesWon + b.gamesLost || 1);
    if (bRatio !== aRatio) return bRatio - aRatio;
    return b.pointDiff - a.pointDiff;
  });

  return standings;
}

export async function getPublicTournamentData(tournamentId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      divisions: true,
      courts: {
        include: {
          matches: {
            where: { status: { in: ["IN_PROGRESS", "DISPUTED", "PAUSED"] } },
            include: {
              teamA: true,
              teamB: true,
              games: {
                orderBy: { gameNumber: "asc" },
              },
            },
          },
        },
      },
    },
  });

  if (!tournament) return null;

  const standingsMap: Record<string, any[]> = {};
  for (const division of tournament.divisions) {
    standingsMap[division.id] = await getDivisionStandings(division.id);
  }

  const matches = await prisma.match.findMany({
    where: { division: { tournamentId } },
    include: {
      division: true,
      court: true,
      teamA: true,
      teamB: true,
      games: {
        orderBy: { gameNumber: "asc" },
      },
    },
    orderBy: { scheduledTime: "asc" },
  });

  return {
    tournament,
    standings: standingsMap,
    matches,
  };
}
