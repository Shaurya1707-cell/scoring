import prisma from "./db";
import { MatchStatus, GameStatus, ScoringType, EnteredByRole } from "@prisma/client";

interface ScoreResult {
  gameId: string;
  teamAScore: number;
  teamBScore: number;
  servingTeamId: string | null;
  serverNumber: number | null;
  gameStatus: GameStatus;
  matchStatus: MatchStatus;
  winnerId: string | null;
}

import { calculateNextState } from "./rules";

/**
 * Records a point scored in a match game.
 */
export async function recordPoint(options: {
  matchId: string;
  gameId: string;
  scoringTeamId: string;
  userId: string;
  role: EnteredByRole;
  deviceId?: string;
}): Promise<ScoreResult> {
  const { matchId, gameId, scoringTeamId, userId, role, deviceId } = options;

  // Retrieve match, division, and tournament configurations
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      division: {
        include: {
          tournament: true,
        },
      },
      games: {
        orderBy: { gameNumber: "asc" },
      },
    },
  });

  if (!match) {
    throw new Error("Match not found");
  }

  // Check if match is in progress or can be edited
  if (match.status === MatchStatus.COMPLETED) {
    throw new Error("Cannot edit a completed match");
  }

  // If referee tries to edit but match is locked by admin (or disputed), reject
  if (role === EnteredByRole.REFEREE && match.status === MatchStatus.DISPUTED) {
    throw new Error("Match is currently flagged as disputed and locked by admin");
  }

  const game = match.games.find((g) => g.id === gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  if (game.status === GameStatus.COMPLETED) {
    throw new Error("Game is already completed");
  }

  // Determine if it is a doubles division
  // Querying player count on teams in this match to confirm singles vs doubles
  const teamAPlayers = await prisma.teamPlayer.count({
    where: { teamId: match.teamAId },
  });
  const isDoubles = teamAPlayers > 1;

  const pointsToWin = match.division.tournament.pointsToWin;
  const winBy = match.division.tournament.winBy;
  const scoringType = match.division.scoringType;

  // Compute next state
  const nextState = calculateNextState({
    scoringTeamId,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    currentTeamAScore: game.teamAScore,
    currentTeamBScore: game.teamBScore,
    currentServingTeamId: game.servingTeamId,
    currentServerNumber: game.serverNumber,
    scoringType,
    isDoubles,
    pointsToWin,
    winBy,
  });

  // Use transaction to write the PointEvent and update the Game score
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the point event
    await tx.pointEvent.create({
      data: {
        gameId,
        scoringTeamId,
        teamAScoreAfter: nextState.teamAScore,
        teamBScoreAfter: nextState.teamBScore,
        enteredByUserId: userId,
        enteredByRole: role,
        deviceId: deviceId || null,
      },
    });

    // 2. Update the Game score and status
    const updatedGame = await tx.game.update({
      where: { id: gameId },
      data: {
        teamAScore: nextState.teamAScore,
        teamBScore: nextState.teamBScore,
        servingTeamId: nextState.servingTeamId,
        serverNumber: nextState.serverNumber,
        status: nextState.isGameFinished ? GameStatus.COMPLETED : GameStatus.IN_PROGRESS,
      },
    });

    let matchStatus = match.status;
    let winnerId: string | null = null;

    // If the game was finished, check if the entire match is finished
    if (nextState.isGameFinished) {
      // Re-fetch all games for the match within transaction to be safe
      const allGames = await tx.game.findMany({
        where: { matchId },
      });

      // Calculate number of games won by each team
      let teamAWins = 0;
      let teamBWins = 0;

      for (const g of allGames) {
        const isGameGCompleted = g.id === gameId ? true : g.status === GameStatus.COMPLETED;
        const scoreA = g.id === gameId ? nextState.teamAScore : g.teamAScore;
        const scoreB = g.id === gameId ? nextState.teamBScore : g.teamBScore;

        if (isGameGCompleted) {
          if (scoreA > scoreB) {
            teamAWins++;
          } else if (scoreB > scoreA) {
            teamBWins++;
          }
        }
      }

      const bestOf = match.division.tournament.bestOf;
      const gamesNeededToWin = Math.ceil(bestOf / 2);

      if (teamAWins >= gamesNeededToWin) {
        matchStatus = MatchStatus.COMPLETED;
        winnerId = match.teamAId;
      } else if (teamBWins >= gamesNeededToWin) {
        matchStatus = MatchStatus.COMPLETED;
        winnerId = match.teamBId;
      } else if (allGames.length < bestOf && (teamAWins + teamBWins < bestOf)) {
        // Create next game if match is not finished
        const nextGameNumber = allGames.length + 1;
        // Determine first serving team of the next game (e.g. alternate or loser of previous serves)
        // For simplicity, alternate initial serve or let the loser serve. Let's let the other team serve.
        const prevGameServingTeamId = game.servingTeamId || match.teamAId;
        const nextGameServingTeamId = prevGameServingTeamId === match.teamAId ? match.teamBId : match.teamAId;

        await tx.game.create({
          data: {
            matchId,
            gameNumber: nextGameNumber,
            teamAScore: 0,
            teamBScore: 0,
            servingTeamId: nextGameServingTeamId,
            serverNumber: isDoubles ? 2 : null, // starts at server 2 on first serve of game
            status: GameStatus.IN_PROGRESS,
          },
        });
      }
    }

    // Update match status & winner if changed
    if (matchStatus !== match.status || winnerId) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: matchStatus,
          winnerId,
        },
      });
    }

    return {
      gameId,
      teamAScore: nextState.teamAScore,
      teamBScore: nextState.teamBScore,
      servingTeamId: nextState.servingTeamId,
      serverNumber: nextState.serverNumber,
      gameStatus: nextState.isGameFinished ? GameStatus.COMPLETED : GameStatus.IN_PROGRESS,
      matchStatus,
      winnerId,
    };
  });

  return result;
}

/**
 * Undoes the last point recorded in a game.
 */
export async function undoLastPoint(options: {
  matchId: string;
  gameId: string;
  userId: string;
  role: EnteredByRole;
}): Promise<ScoreResult> {
  const { matchId, gameId, userId, role } = options;

  // Retrieve match, division, and tournament configurations
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      division: {
        include: {
          tournament: true,
        },
      },
      games: true,
    },
  });

  if (!match) {
    throw new Error("Match not found");
  }

  if (match.status === MatchStatus.COMPLETED) {
    throw new Error("Cannot undo a point in a completed match");
  }

  if (role === EnteredByRole.REFEREE && match.status === MatchStatus.DISPUTED) {
    throw new Error("Match is locked by admin");
  }

  const game = match.games.find((g) => g.id === gameId);
  if (!game) {
    throw new Error("Game not found");
  }

  // Find the last point event for this game
  const lastEvent = await prisma.pointEvent.findFirst({
    where: { gameId },
    orderBy: { createdAt: "desc" },
  });

  if (!lastEvent) {
    // If no point events exist, reset score to 0-0
    const teamAPlayers = await prisma.teamPlayer.count({
      where: { teamId: match.teamAId },
    });
    const isDoubles = teamAPlayers > 1;

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        teamAScore: 0,
        teamBScore: 0,
        servingTeamId: match.teamAId,
        serverNumber: isDoubles ? 2 : null,
        status: GameStatus.IN_PROGRESS,
      },
    });

    return {
      gameId,
      teamAScore: 0,
      teamBScore: 0,
      servingTeamId: match.teamAId,
      serverNumber: isDoubles ? 2 : null,
      gameStatus: GameStatus.IN_PROGRESS,
      matchStatus: match.status,
      winnerId: null,
    };
  }

  // Use transaction to delete the point event and restore the previous state
  const result = await prisma.$transaction(async (tx) => {
    // Delete the last event
    await tx.pointEvent.delete({
      where: { id: lastEvent.id },
    });

    // Find the new last event to find the previous scores
    const prevEvent = await tx.pointEvent.findFirst({
      where: { gameId },
      orderBy: { createdAt: "desc" },
    });

    // Determine the previous score and server
    const prevAScore = prevEvent ? prevEvent.teamAScoreAfter : 0;
    const prevBScore = prevEvent ? prevEvent.teamBScoreAfter : 0;

    // Recalculate serving state by playing events forward up to prevEvent
    const teamAPlayers = await tx.teamPlayer.count({
      where: { teamId: match.teamAId },
    });
    const isDoubles = teamAPlayers > 1;

    let tempServingTeamId = match.teamAId;
    let tempServerNumber: number | null = isDoubles ? 2 : null; // first server is 2 by rule

    const allEvents = await tx.pointEvent.findMany({
      where: { gameId },
      orderBy: { createdAt: "asc" },
    });

    let tempAScore = 0;
    let tempBScore = 0;

    for (const ev of allEvents) {
      const state = calculateNextState({
        scoringTeamId: ev.scoringTeamId,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        currentTeamAScore: tempAScore,
        currentTeamBScore: tempBScore,
        currentServingTeamId: tempServingTeamId,
        currentServerNumber: tempServerNumber,
        scoringType: match.division.scoringType,
        isDoubles,
        pointsToWin: match.division.tournament.pointsToWin,
        winBy: match.division.tournament.winBy,
      });

      tempAScore = state.teamAScore;
      tempBScore = state.teamBScore;
      tempServingTeamId = state.servingTeamId!;
      tempServerNumber = state.serverNumber;
    }

    // Update Game to restored state
    await tx.game.update({
      where: { id: gameId },
      data: {
        teamAScore: prevAScore,
        teamBScore: prevBScore,
        servingTeamId: tempServingTeamId,
        serverNumber: tempServerNumber,
        status: GameStatus.IN_PROGRESS, // Game cannot be completed if we just undid a point
      },
    });

    // Revert match status if it was completed
    if (match.status === MatchStatus.COMPLETED) {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.IN_PROGRESS,
          winnerId: null,
        },
      });
    }

    return {
      gameId,
      teamAScore: prevAScore,
      teamBScore: prevBScore,
      servingTeamId: tempServingTeamId,
      serverNumber: tempServerNumber,
      gameStatus: GameStatus.IN_PROGRESS,
      matchStatus: MatchStatus.IN_PROGRESS,
      winnerId: null,
    };
  });

  return result;
}
