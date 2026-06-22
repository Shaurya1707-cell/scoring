"use server";

import prisma from "@/lib/db";
import sseBroker from "@/lib/sse";
import { MatchStatus, CourtStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { recordPoint, undoLastPoint } from "@/lib/scoringEngine";
import bcrypt from "bcryptjs";

/**
 * Form action wrapper that returns Promise<void> for TypeScript compilation.
 */
export async function reseedFormAction() {
  await reseedDatabaseAction();
}

/**
 * Server Action to re-seed/reset the database.
 */
export async function reseedDatabaseAction() {
  try {
    console.log("[Admin Action] Reseed database requested.");
    
    // Clean and seed the database (reusing logic from seed.ts)
    await prisma.auditLog.deleteMany();
    await prisma.pointEvent.deleteMany();
    await prisma.game.deleteMany();
    await prisma.match.deleteMany();
    await prisma.court.deleteMany();
    await prisma.teamPlayer.deleteMany();
    await prisma.player.deleteMany();
    await prisma.team.deleteMany();
    await prisma.division.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tournament.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);
    
    const admin = await prisma.user.create({
      data: {
        name: "Tournament Admin",
        email: "admin@tournament.com",
        role: "ADMIN",
        password: hashedPassword,
      },
    });

    const referee = await prisma.user.create({
      data: {
        name: "John Ref",
        email: "ref@tournament.com",
        role: "REFEREE",
        password: hashedPassword,
      },
    });

    const tournament = await prisma.tournament.create({
      data: {
        name: "Summer Pickleball Smash 2026",
        location: "Central Park Sports Center",
        startDate: new Date("2026-06-25T08:00:00Z"),
        endDate: new Date("2026-06-27T18:00:00Z"),
        status: "live",
        pointsToWin: 11,
        winBy: 2,
        bestOf: 3,
      },
    });

    const court1 = await prisma.court.create({
      data: { name: "Court 1", tournamentId: tournament.id, status: CourtStatus.ACTIVE },
    });
    const court2 = await prisma.court.create({
      data: { name: "Court 2", tournamentId: tournament.id, status: CourtStatus.ACTIVE },
    });
    const court3 = await prisma.court.create({
      data: { name: "Court 3", tournamentId: tournament.id, status: CourtStatus.IDLE },
    });

    const mensDoubles = await prisma.division.create({
      data: {
        name: "Men's Doubles 4.0",
        tournamentId: tournament.id,
        format: "ROUND_ROBIN",
        scoringType: "RALLY",
      },
    });

    const womensSingles = await prisma.division.create({
      data: {
        name: "Women's Singles Open",
        tournamentId: tournament.id,
        format: "SINGLE_ELIM",
        scoringType: "TRADITIONAL",
      },
    });

    const playerNames = [
      "Alex Miller", "Ben Smith", "Charlie Davis", "Danny Evans",
      "Emma Watson", "Fiona Gallagher", "Grace Hopper", "Hannah Abbott",
      "Ian Wright", "Jack Jones", "Kevin Hart", "Leo Messi"
    ];

    const players = [];
    for (const name of playerNames) {
      const player = await prisma.player.create({
        data: {
          name,
          skillLevel: name.includes("Messi") || name.includes("Hopper") ? "5.0" : "4.0",
          contactInfo: `${name.toLowerCase().replace(" ", ".")}@example.com`,
        },
      });
      players.push(player);
    }

    const mdTeam1 = await prisma.team.create({
      data: {
        name: "Alex & Ben",
        divisionId: mensDoubles.id,
        players: { create: [{ playerId: players[0].id }, { playerId: players[1].id }] }
      }
    });

    const mdTeam2 = await prisma.team.create({
      data: {
        name: "Charlie & Danny",
        divisionId: mensDoubles.id,
        players: { create: [{ playerId: players[2].id }, { playerId: players[3].id }] }
      }
    });

    const mdTeam3 = await prisma.team.create({
      data: {
        name: "Ian & Jack",
        divisionId: mensDoubles.id,
        players: { create: [{ playerId: players[8].id }, { playerId: players[9].id }] }
      }
    });

    const mdTeam4 = await prisma.team.create({
      data: {
        name: "Kevin & Leo",
        divisionId: mensDoubles.id,
        players: { create: [{ playerId: players[10].id }, { playerId: players[11].id }] }
      }
    });

    const wsTeam1 = await prisma.team.create({
      data: {
        name: "Emma Watson",
        divisionId: womensSingles.id,
        players: { create: [{ playerId: players[4].id }] }
      }
    });

    const wsTeam2 = await prisma.team.create({
      data: {
        name: "Fiona Gallagher",
        divisionId: womensSingles.id,
        players: { create: [{ playerId: players[5].id }] }
      }
    });

    const wsTeam3 = await prisma.team.create({
      data: {
        name: "Grace Hopper",
        divisionId: womensSingles.id,
        players: { create: [{ playerId: players[6].id }] }
      }
    });

    const wsTeam4 = await prisma.team.create({
      data: {
        name: "Hannah Abbott",
        divisionId: womensSingles.id,
        players: { create: [{ playerId: players[7].id }] }
      }
    });

    const match1 = await prisma.match.create({
      data: {
        divisionId: mensDoubles.id,
        courtId: court1.id,
        round: "Round 1",
        scheduledTime: new Date("2026-06-25T09:00:00Z"),
        teamAId: mdTeam1.id,
        teamBId: mdTeam2.id,
        status: MatchStatus.IN_PROGRESS,
        games: {
          create: [
            { gameNumber: 1, teamAScore: 11, teamBScore: 8, status: "COMPLETED" },
            { gameNumber: 2, teamAScore: 5, teamBScore: 8, status: "IN_PROGRESS" }
          ]
        }
      }
    });

    await prisma.match.create({
      data: {
        divisionId: mensDoubles.id,
        courtId: court2.id,
        round: "Round 1",
        scheduledTime: new Date("2026-06-25T10:00:00Z"),
        teamAId: mdTeam3.id,
        teamBId: mdTeam4.id,
        status: MatchStatus.SCHEDULED,
      }
    });

    await prisma.match.create({
      data: {
        divisionId: womensSingles.id,
        courtId: court3.id,
        round: "Semifinals",
        scheduledTime: new Date("2026-06-25T09:30:00Z"),
        teamAId: wsTeam1.id,
        teamBId: wsTeam2.id,
        status: MatchStatus.SCHEDULED,
      }
    });

    const match4 = await prisma.match.create({
      data: {
        divisionId: womensSingles.id,
        courtId: court2.id,
        round: "Semifinals",
        scheduledTime: new Date("2026-06-25T10:30:00Z"),
        teamAId: wsTeam3.id,
        teamBId: wsTeam4.id,
        status: MatchStatus.IN_PROGRESS,
        games: {
          create: [
            { 
              gameNumber: 1, 
              teamAScore: 4, 
              teamBScore: 6, 
              status: "IN_PROGRESS",
              servingTeamId: wsTeam3.id,
              serverNumber: 1
            }
          ]
        }
      }
    });

    // Broadcast update via SSE to all viewers
    sseBroker.broadcast(`tournament:${tournament.id}`, "tournament_reset", { tournamentId: tournament.id });
    sseBroker.broadcast("all", "database_reset", {});

    revalidatePath("/admin");
    revalidatePath("/");
    return { success: true };
  } catch (err: any) {
    console.error("Reseed database action error:", err);
    return { error: err.message };
  }
}

/**
 * Admin override: Manually update game score, log in audit trail.
 */
export async function adminOverrideScoreAction(options: {
  matchId: string;
  gameId: string;
  teamAScore: number;
  teamBScore: number;
  servingTeamId: string | null;
  serverNumber: number | null;
  adminId: string;
}) {
  const { matchId, gameId, teamAScore, teamBScore, servingTeamId, serverNumber, adminId } = options;

  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { games: true, division: true },
    });

    if (!match) throw new Error("Match not found");
    const game = match.games.find((g) => g.id === gameId);
    if (!game) throw new Error("Game not found");

    const oldValues = {
      teamAScore: game.teamAScore,
      teamBScore: game.teamBScore,
      servingTeamId: game.servingTeamId,
      serverNumber: game.serverNumber,
      status: game.status,
    };

    const newValues = {
      teamAScore,
      teamBScore,
      servingTeamId,
      serverNumber,
      status: game.status, // We can let the admin override status later if needed
    };

    // Update DB
    await prisma.$transaction(async (tx) => {
      // 1. Update Game
      await tx.game.update({
        where: { id: gameId },
        data: {
          teamAScore,
          teamBScore,
          servingTeamId,
          serverNumber,
        },
      });

      // 2. Write AuditLog
      await tx.auditLog.create({
        data: {
          entityType: "Game",
          entityId: gameId,
          action: "score_override",
          oldValue: JSON.stringify(oldValues),
          newValue: JSON.stringify(newValues),
          performedById: adminId,
        },
      });
    });

    // Broadcast update via SSE
    sseBroker.broadcast(`match:${matchId}`, "score_update", {
      gameId,
      teamAScore,
      teamBScore,
      servingTeamId,
      serverNumber,
    });
    sseBroker.broadcast(`tournament:${match.division.tournamentId}`, "match_update", { matchId });

    revalidatePath("/admin/matches");
    revalidatePath(`/match/${matchId}`);
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    console.error("Score override error:", err);
    return { error: err.message };
  }
}

/**
 * Lock/unlock referee scoring for a disputed match.
 */
export async function toggleMatchDisputeAction(matchId: string, status: MatchStatus, adminId: string) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { division: true },
    });

    if (!match) throw new Error("Match not found");

    const oldStatus = match.status;

    await prisma.$transaction(async (tx) => {
      // 1. Update match status
      await tx.match.update({
        where: { id: matchId },
        data: { status },
      });

      // 2. Audit log
      await tx.auditLog.create({
        data: {
          entityType: "Match",
          entityId: matchId,
          action: status === MatchStatus.DISPUTED ? "match_dispute_flagged" : "match_dispute_resolved",
          oldValue: JSON.stringify({ status: oldStatus }),
          newValue: JSON.stringify({ status }),
          performedById: adminId,
        },
      });
    });

    sseBroker.broadcast(`match:${matchId}`, "status_update", { status });
    sseBroker.broadcast(`tournament:${match.division.tournamentId}`, "match_update", { matchId });

    revalidatePath("/admin/matches");
    revalidatePath(`/match/${matchId}`);
    revalidatePath("/");

    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
