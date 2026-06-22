export enum ScoringType {
  RALLY = "RALLY",
  TRADITIONAL = "TRADITIONAL",
}

/**
 * Calculates the next score and serving state after a point is won by a team.
 * Reusable on both the client (for optimistic UI) and server (for validation).
 */
export function calculateNextState(params: {
  scoringTeamId: string;
  teamAId: string;
  teamBId: string;
  currentTeamAScore: number;
  currentTeamBScore: number;
  currentServingTeamId: string | null;
  currentServerNumber: number | null;
  scoringType: "RALLY" | "TRADITIONAL";
  isDoubles: boolean;
  pointsToWin: number;
  winBy: number;
}): {
  teamAScore: number;
  teamBScore: number;
  servingTeamId: string | null;
  serverNumber: number | null;
  isGameFinished: boolean;
} {
  const {
    scoringTeamId,
    teamAId,
    teamBId,
    currentTeamAScore,
    currentTeamBScore,
    currentServingTeamId,
    currentServerNumber,
    scoringType,
    isDoubles,
    pointsToWin,
    winBy,
  } = params;

  let teamAScore = currentTeamAScore;
  let teamBScore = currentTeamBScore;
  let servingTeamId = currentServingTeamId;
  let serverNumber = currentServerNumber;

  if (scoringType === ScoringType.RALLY) {
    // Rally Scoring: Whoever wins the rally gets a point.
    if (scoringTeamId === teamAId) {
      teamAScore++;
    } else {
      teamBScore++;
    }
  } else {
    // Traditional Scoring: Only the serving team can score.
    if (scoringTeamId === servingTeamId) {
      // Serving team won the rally -> gets a point.
      if (scoringTeamId === teamAId) {
        teamAScore++;
      } else {
        teamBScore++;
      }
    } else {
      // Receiving team won the rally -> Side-out or server change.
      if (isDoubles) {
        if (serverNumber === 1) {
          // Switch to server 2 of the same team
          serverNumber = 2;
        } else {
          // Side-out: Serve goes to the other team, server 1
          servingTeamId = servingTeamId === teamAId ? teamBId : teamAId;
          serverNumber = 1;
        }
      } else {
        // Singles: Immediate side-out, serve goes to the other team
        servingTeamId = servingTeamId === teamAId ? teamBId : teamAId;
        serverNumber = null;
      }
    }
  }

  // Check if game is finished
  const lead = Math.abs(teamAScore - teamBScore);
  const maxScore = Math.max(teamAScore, teamBScore);
  const isGameFinished = maxScore >= pointsToWin && lead >= winBy;

  return {
    teamAScore,
    teamBScore,
    servingTeamId,
    serverNumber,
    isGameFinished,
  };
}
