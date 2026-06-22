import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/authActions";
import Link from "next/link";
import { Trophy, LogOut, ArrowRight, Activity, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RefereeDashboard() {
  const session = await getSession();
  if (!session || (session.role !== "REFEREE" && session.role !== "ADMIN")) {
    redirect("/login");
  }

  // Fetch all matches that are scheduled or currently in progress
  const matches = await prisma.match.findMany({
    where: {
      status: { in: ["SCHEDULED", "IN_PROGRESS", "PAUSED", "DISPUTED"] }
    },
    include: {
      division: true,
      court: true,
      teamA: true,
      teamB: true,
      games: {
        orderBy: { gameNumber: "asc" }
      }
    },
    orderBy: [
      { status: "asc" }, // IN_PROGRESS before SCHEDULED
      { scheduledTime: "asc" },
    ]
  });

  const liveMatches = matches.filter(m => m.status === "IN_PROGRESS" || m.status === "DISPUTED" || m.status === "PAUSED");
  const scheduledMatches = matches.filter(m => m.status === "SCHEDULED");

  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col max-w-md mx-auto border-x border-zinc-850 shadow-sm antialiased">
      {/* Top Mobile Bar */}
      <header className="border-b border-zinc-850 bg-black/85 backdrop-blur-md sticky top-0 z-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-lg flex items-center justify-center">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm leading-none">Referee Hub</h1>
            <span className="text-[9px] text-white font-semibold uppercase tracking-wider mt-1 block">Live Court Scoring</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-zinc-400 font-mono hidden sm:inline">{session.name}</span>
          <form action={logoutAction}>
            <button className="p-2 bg-zinc-900 hover:bg-white hover:text-black border border-zinc-800 text-zinc-400 rounded-lg transition-all" title="Sign Out">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-4 space-y-6 overflow-y-auto">
        
        {/* Welcome Section */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-3.5 space-y-1">
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Welcome, {session.name}</h2>
          <p className="text-[11px] text-zinc-400">Select an active match below to start or resume scorecard entries.</p>
        </div>

        {/* Live Matches Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">In Progress (Live)</h3>
          </div>

          {liveMatches.length === 0 ? (
            <div className="p-6 text-center text-zinc-550 italic text-xs bg-zinc-950 border border-zinc-850 rounded-xl">
              No matches are currently live.
            </div>
          ) : (
            <div className="space-y-3">
              {liveMatches.map((m) => {
                const isLocked = m.status === "DISPUTED";
                const activeGame = m.games.find(g => g.status === "IN_PROGRESS") || m.games[m.games.length - 1];

                return (
                  <Link
                    key={m.id}
                    href={isLocked ? "#" : `/referee/scorecard/${m.id}`}
                    className={`block p-4 rounded-xl border text-left transition-all ${
                      isLocked
                        ? "bg-black border border-zinc-800/80 border-dashed opacity-60 cursor-not-allowed"
                        : "bg-zinc-950 border-2 border-white hover:bg-zinc-900/20 active:scale-[0.99]"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[9px] font-bold font-mono text-white uppercase flex items-center tracking-wider">
                        <MapPin className="w-3 h-3 mr-1 text-zinc-500" />
                        {m.court?.name || "No Court"} • {m.round}
                      </span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase ${
                        isLocked
                          ? "bg-black text-white border border-dashed border-white"
                          : "bg-white text-black border border-white"
                      }`}>
                        {isLocked ? "Disputed (Locked)" : "Active"}
                      </span>
                    </div>

                    <div className="space-y-1.5 border-b border-zinc-850 pb-3">
                      <div className="flex justify-between items-center text-xs font-medium text-zinc-200">
                        <span>{m.teamA.name}</span>
                        <span className="font-mono text-zinc-350 font-semibold">
                          {activeGame ? activeGame.teamAScore : 0}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-medium text-zinc-200">
                        <span>{m.teamB.name}</span>
                        <span className="font-mono text-zinc-355 font-semibold">
                          {activeGame ? activeGame.teamBScore : 0}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2.5 flex justify-between items-center text-[10px] text-zinc-500">
                      <span className="font-medium uppercase tracking-wider text-[9px]">{m.division.name}</span>
                      {!isLocked && (
                        <span className="flex items-center text-white font-bold underline">
                          Resume <ArrowRight className="w-3 h-3 ml-1" />
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Scheduled Matches Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Upcoming Schedule</h3>

          {scheduledMatches.length === 0 ? (
            <div className="p-6 text-center text-zinc-550 italic text-xs bg-zinc-950 border border-zinc-850 rounded-xl">
              No upcoming matches scheduled.
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledMatches.map((m) => {
                return (
                  <Link
                    key={m.id}
                    href={`/referee/scorecard/${m.id}`}
                    className="block p-4 rounded-xl border border-zinc-850 bg-zinc-950 hover:border-zinc-700 active:scale-[0.99] transition-all"
                  >
                    <div className="flex justify-between items-center mb-2.5">
                      <span className="text-[9px] font-bold font-mono text-zinc-400 uppercase flex items-center tracking-wider">
                        <MapPin className="w-3 h-3 mr-1 text-zinc-600" />
                        {m.court?.name || "Unassigned"} • {m.round}
                      </span>
                      {m.scheduledTime && (
                        <span className="text-[9px] text-zinc-500 font-mono font-medium">
                          {new Date(m.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 pb-2.5 border-b border-zinc-850 text-xs text-zinc-300">
                      <div className="font-medium">{m.teamA.name}</div>
                      <div className="font-medium">{m.teamB.name}</div>
                    </div>

                    <div className="pt-2 flex justify-between items-center text-[10px] text-zinc-500">
                      <span className="font-medium uppercase tracking-wider text-[9px]">{m.division.name}</span>
                      <span className="flex items-center text-white font-bold underline">
                        Start Match <ArrowRight className="w-3 h-3 ml-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="p-3.5 border-t border-zinc-850 text-center text-[10px] text-zinc-500 bg-black/85 sticky bottom-0">
        Logged in as <span className="font-semibold text-zinc-350">{session.name}</span> ({session.role.toLowerCase()})
      </footer>
    </div>
  );
}
