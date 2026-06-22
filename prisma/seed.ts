import { UserRole, DivisionFormat, ScoringType, MatchStatus, CourtStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "../src/lib/db";

async function main() {
  console.log("Seeding started...");

  // Clean the database
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

  console.log("Database cleared.");

  // Create Users (Admin & Referee)
  const hashedPassword = await bcrypt.hash("password123", 10);
  
  const admin = await prisma.user.create({
    data: {
      name: "Tournament Admin",
      email: "admin@tournament.com",
      role: UserRole.ADMIN,
      password: hashedPassword,
    },
  });

  const referee = await prisma.user.create({
    data: {
      name: "John Ref",
      email: "ref@tournament.com",
      role: UserRole.REFEREE,
      password: hashedPassword,
    },
  });

  console.log("Users created:", { admin: admin.email, referee: referee.email });

  // Create Tournament
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

  console.log("Tournament created:", tournament.name);

  // Create Courts
  const court1 = await prisma.court.create({
    data: { name: "Court 1", tournamentId: tournament.id, status: CourtStatus.ACTIVE },
  });
  const court2 = await prisma.court.create({
    data: { name: "Court 2", tournamentId: tournament.id, status: CourtStatus.ACTIVE },
  });
  const court3 = await prisma.court.create({
    data: { name: "Court 3", tournamentId: tournament.id, status: CourtStatus.IDLE },
  });

  console.log("Courts created.");

  // Create Divisions
  const mensDoubles = await prisma.division.create({
    data: {
      name: "Men's Doubles 4.0",
      tournamentId: tournament.id,
      format: DivisionFormat.ROUND_ROBIN,
      scoringType: ScoringType.RALLY, // Rally scoring is default
    },
  });

  const womensSingles = await prisma.division.create({
    data: {
      name: "Women's Singles Open",
      tournamentId: tournament.id,
      format: DivisionFormat.SINGLE_ELIM,
      scoringType: ScoringType.TRADITIONAL, // Traditional scoring
    },
  });

  console.log("Divisions created.");

  // Create Players
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

  console.log("Players created.");

  // Create Teams for Men's Doubles (4 teams, 2 players each)
  const mdTeam1 = await prisma.team.create({
    data: {
      name: "Alex & Ben",
      divisionId: mensDoubles.id,
      players: {
        create: [
          { playerId: players[0].id },
          { playerId: players[1].id }
        ]
      }
    }
  });

  const mdTeam2 = await prisma.team.create({
    data: {
      name: "Charlie & Danny",
      divisionId: mensDoubles.id,
      players: {
        create: [
          { playerId: players[2].id },
          { playerId: players[3].id }
        ]
      }
    }
  });

  const mdTeam3 = await prisma.team.create({
    data: {
      name: "Ian & Jack",
      divisionId: mensDoubles.id,
      players: {
        create: [
          { playerId: players[8].id },
          { playerId: players[9].id }
        ]
      }
    }
  });

  const mdTeam4 = await prisma.team.create({
    data: {
      name: "Kevin & Leo",
      divisionId: mensDoubles.id,
      players: {
        create: [
          { playerId: players[10].id },
          { playerId: players[11].id }
        ]
      }
    }
  });

  // Create Teams for Women's Singles (4 teams, 1 player each)
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

  console.log("Teams created and players assigned.");

  // Create Matches for Men's Doubles
  // Match 1: Alex & Ben vs Charlie & Danny (Live!)
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

  // Match 2: Ian & Jack vs Kevin & Leo (Scheduled)
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

  // Create Matches for Women's Singles
  // Match 3: Emma Watson vs Fiona Gallagher (Scheduled)
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

  // Match 4: Grace Hopper vs Hannah Abbott (Live!)
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
            servingTeamId: wsTeam3.id, // Grace Hopper serving
            serverNumber: 1
          }
        ]
      }
    }
  });

  console.log("Matches created.");
  console.log("Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
