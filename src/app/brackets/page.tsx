import prisma from "@/lib/db";
import Link from "next/link";
import { Trophy, ChevronLeft, Calendar, MapPin, Tv } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BracketsPage() {
  // Fetch the primary tournament
  const tournament = await prisma.tournament.findFirst({
    orderBy: { startDate: "asc" },
  });

  if (!tournament) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
        <div className="text-center space-y-2">
          <Trophy className="w-12 h-12 text-white mx-auto animate-pulse" />
          <h1 className="text-xl font-bold">No Tournaments Found</h1>
          <p className="text-zinc-400">Initialize the database first.</p>
        </div>
      </main>
    );
  }

  // Fetch the single elimination matches (e.g. Women's Singles Open)
  const division = await prisma.division.findFirst({
    where: { 
      tournamentId: tournament.id,
      format: "SINGLE_ELIM"
    },
    include: {
      matches: {
        include: {
          court: true,
          teamA: true,
          teamB: true,
          games: {
            orderBy: { gameNumber: "asc" }
          }
        },
        orderBy: { scheduledTime: "asc" }
      }
    }
  });

  if (!division) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
        <div className="text-center space-y-4 max-w-sm">
          <Trophy className="w-12 h-12 text-white mx-auto" />
          <h1 className="text-xl font-bold">No Brackets Configured</h1>
          <p className="text-zinc-400 text-sm">
            This tournament does not have any single elimination or bracket-style divisions configured yet.
          </p>
          <Link href="/" className="text-white hover:underline font-semibold text-sm underline">
            Back to Leaderboard
          </Link>
        </div>
      </main>
    );
  }

  // Group matches by round (Semifinals vs Finals)
  const semiMatches = division.matches.filter(m => m.round === "Semifinals");
  
  // We can construct a mock / placeholder for the Finals match if it hasn't been created yet.
  // In our seed, there are 2 Semifinals matches. The Finals match can be derived.
  const finalMatch = division.matches.find(m => m.round === "Finals") || {
    id: "finals-placeholder",
    status: "SCHEDULED",
    round: "Finals",
    court: null,
    teamA: { id: "t1-winner", name: "Winner Semifinal 1" },
    teamB: { id: "t2-winner", name: "Winner Semifinal 2" },
    games: [],
    winnerId: null,
  };

  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-zinc-850 bg-black/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-400 hover:text-white rounded-xl transition-all"
            title="Back to Leaderboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-sm">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Tournament Brackets</h1>
              <span className="text-xs text-zinc-400 font-semibold">Championship Flow</span>
            </div>
          </div>
        </div>

        <span className="text-xs text-zinc-500 uppercase tracking-widest font-mono hidden sm:inline">
          {tournament.name}
        </span>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-12 flex flex-col justify-center">
        
        {/* Banner */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            {division.name} Bracket
          </h2>
          <p className="text-zinc-500 text-sm">Follow the path to the championship title</p>
        </div>

        {/* Dynamic Bracket Graphic Flow */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-4 items-center justify-center max-w-4xl mx-auto w-full relative">
          
          {/* Round 1: Semifinals */}
          <div className="space-y-12 relative flex flex-col justify-center">
            <h3 className="text-center font-bold text-zinc-500 text-xs uppercase tracking-wider mb-2 font-mono">
              Semifinals
            </h3>

            {semiMatches.map((m, i) => {
              const isLive = m.status === "IN_PROGRESS" || m.status === "DISPUTED";
              const isCompleted = m.status === "COMPLETED";
              const activeGame = m.games.find(g => g.status === "IN_PROGRESS") || m.games[m.games.length - 1];

              return (
                <div key={m.id} className="relative">
                  {/* Visual Connection Line */}
                  <div className="absolute right-[-32px] top-1/2 w-[32px] h-px bg-zinc-800 hidden md:block"></div>
                  
                  <div 
                    className={`bg-zinc-950 border border-zinc-850 rounded-2xl p-4 shadow-sm w-72 mx-auto ${
                      isLive ? "border-2 border-white" : ""
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2 text-[10px] text-zinc-505">
                      <span className="font-mono">{m.court?.name || "Unassigned"}</span>
                      <span className={`font-extrabold uppercase tracking-wider ${
                        isLive ? "text-white underline" : isCompleted ? "text-zinc-400" : "text-zinc-550"
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className={`font-semibold ${m.winnerId === m.teamA.id ? "text-white font-bold underline" : "text-zinc-300"}`}>
                          {m.teamA.name}
                        </span>
                        <span className="font-mono text-zinc-300 font-bold">
                          {activeGame ? activeGame.teamAScore : (isCompleted && m.games[0] ? m.games.map(g => g.teamAScore).join("-") : 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className={`font-semibold ${m.winnerId === m.teamB.id ? "text-white font-bold underline" : "text-zinc-300"}`}>
                          {m.teamB.name}
                        </span>
                        <span className="font-mono text-zinc-300 font-bold">
                          {activeGame ? activeGame.teamBScore : (isCompleted && m.games[0] ? m.games.map(g => g.teamBScore).join("-") : 0)}
                        </span>
                      </div>
                    </div>

                    {isLive && (
                      <Link 
                        href={`/match/${m.id}`}
                        className="mt-3 block text-center bg-white text-black hover:bg-zinc-200 text-[10px] font-extrabold py-1.5 rounded-lg uppercase tracking-wider transition-colors"
                      >
                        Monitor Live Scores
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Central Vertical Connector (for flow) */}
          <div className="absolute left-1/2 top-[calc(25%+40px)] bottom-[calc(25%-40px)] w-px bg-zinc-805 hidden md:block"></div>

          {/* Round 2: Championship Finals */}
          <div className="flex flex-col justify-center items-center relative">
            <h3 className="text-center font-bold text-zinc-550 text-xs uppercase tracking-wider mb-2 font-mono">
              Championship Finals
            </h3>

            {/* Visual Line coming from the left */}
            <div className="absolute left-0 top-1/2 w-[32px] h-px bg-zinc-800 hidden md:block"></div>

            <div className="bg-zinc-950 border-2 border-white rounded-3xl p-6 shadow-sm w-80 relative overflow-hidden">
              <div className="flex justify-between items-center mb-3 text-[10px] text-zinc-550">
                <span className="font-mono uppercase font-bold text-white flex items-center">
                  <Trophy className="w-3.5 h-3.5 mr-1" />
                  Gold Medal Match
                </span>
                <span className="uppercase font-semibold tracking-wider text-zinc-500">
                  {finalMatch.status}
                </span>
              </div>

              <div className="space-y-3 my-4">
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-semibold ${finalMatch.winnerId === finalMatch.teamA.id ? "text-white font-bold underline" : "text-zinc-300"}`}>
                    {finalMatch.teamA.name}
                  </span>
                  <span className="font-mono text-zinc-300 font-bold">
                    {finalMatch.games && finalMatch.games.length > 0 ? finalMatch.games[0].teamAScore : "—"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className={`font-semibold ${finalMatch.winnerId === finalMatch.teamB.id ? "text-white font-bold underline" : "text-zinc-300"}`}>
                    {finalMatch.teamB.name}
                  </span>
                  <span className="font-mono text-zinc-300 font-bold">
                    {finalMatch.games && finalMatch.games.length > 0 ? finalMatch.games[0].teamBScore : "—"}
                  </span>
                </div>
              </div>

              {finalMatch.id !== "finals-placeholder" && finalMatch.status === "IN_PROGRESS" && (
                <Link 
                  href={`/match/${finalMatch.id}`}
                  className="w-full text-center bg-white hover:bg-zinc-200 text-black text-xs font-bold py-2.5 rounded-xl transition-all block"
                >
                  Watch Live Scoreboard
                </Link>
              )}
            </div>
          </div>

        </div>

      </main>

      <footer className="border-t border-zinc-850 bg-black p-6 text-center text-xs text-zinc-500 mt-12">
        Standings & Bracket path updates immediately upon completion of active matches.
      </footer>
    </div>
  );
}
