import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logoutAction } from "@/app/actions/authActions";
import { reseedFormAction } from "@/app/actions/adminActions";
import { redirect } from "next/navigation";
import { 
  Trophy, 
  MapPin, 
  Layers, 
  Users, 
  FolderGit2, 
  Activity, 
  Settings, 
  LogOut,
  RefreshCw,
  Edit,
  AlertTriangle
} from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  // Fetch the primary tournament
  const tournament = await prisma.tournament.findFirst({
    orderBy: { startDate: "asc" },
    include: {
      divisions: {
        include: {
          teams: true,
          matches: true,
        }
      },
      courts: {
        include: {
          matches: {
            where: { status: "IN_PROGRESS" },
            include: {
              teamA: true,
              teamB: true,
              games: {
                orderBy: { gameNumber: "asc" }
              }
            }
          }
        }
      }
    }
  });

  if (!tournament) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100 min-h-screen">
        <div className="text-center space-y-4">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold">No Tournaments Found</h1>
          <p className="text-slate-400">The database appears to be empty. Please run the seed/reset script.</p>
          <form action={reseedFormAction}>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 px-6 font-semibold flex items-center space-x-2 mx-auto transition-all shadow-lg shadow-indigo-600/30">
              <RefreshCw className="w-5 h-5" />
              <span>Initialize Database</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Calculate aggregated stats
  const divisionsCount = tournament.divisions.length;
  let teamsCount = 0;
  let matchesCount = 0;
  for (const d of tournament.divisions) {
    teamsCount += d.teams.length;
    matchesCount += d.matches.length;
  }
  const courtsCount = tournament.courts.length;
  const playersCount = await prisma.player.count();

  // Fetch all active/live matches
  const activeMatches = await prisma.match.findMany({
    where: { 
      division: { tournamentId: tournament.id },
      status: { in: ["IN_PROGRESS", "DISPUTED", "PAUSED"] }
    },
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

  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col antialiased">
      {/* Top Navbar */}
      <header className="border-b border-zinc-850 bg-black/85 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-sm">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none">Antigravity Admin</h1>
            <span className="text-[10px] text-white font-semibold uppercase tracking-wider mt-1 block">Tournament Management</span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-semibold text-zinc-200">{session.name}</p>
            <p className="text-[10px] text-zinc-505 uppercase font-mono tracking-wider">{session.role}</p>
          </div>
          
          <form action={logoutAction}>
            <button className="p-2.5 bg-zinc-900 hover:bg-white hover:text-black border border-zinc-800 text-zinc-400 rounded-xl transition-all" title="Sign Out">
              <LogOut className="w-5 h-5" />
            </button>
          </form>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        
        {/* Tournament Info Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-950 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black border border-white uppercase tracking-widest">
              {tournament.status} event
            </span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {tournament.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-455 text-xs font-medium">
              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5 text-zinc-500" /> {tournament.location}</span>
              <span className="text-zinc-700">•</span>
              <span>{new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link 
              href="/admin/matches" 
              className="bg-white hover:bg-zinc-200 text-black rounded-xl py-3 px-5 font-bold text-xs transition-all flex items-center space-x-2 shadow-sm"
            >
              <Edit className="w-4 h-4" />
              <span>Override Scores</span>
            </Link>

            <form action={reseedFormAction}>
              <button 
                type="submit" 
                className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl py-3 px-5 font-semibold text-xs transition-all flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Database</span>
              </button>
            </form>
          </div>
        </div>

        {/* Quick Actions Panel */}
        <section className="bg-zinc-950 border border-zinc-855 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quick Controls</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link 
              href="/admin/matches"
              className="p-4 bg-black hover:bg-zinc-900/30 border border-zinc-850 hover:border-white rounded-xl text-center group transition-all"
            >
              <span className="text-white group-hover:underline font-semibold block text-xs uppercase tracking-wider">Override Scoreboard</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Force update scores & override disputes</span>
            </Link>
            <Link 
              href="/"
              className="p-4 bg-black hover:bg-zinc-900/30 border border-zinc-855 hover:border-white rounded-xl text-center group transition-all"
            >
              <span className="text-white group-hover:underline font-semibold block text-xs uppercase tracking-wider">Public Dashboard</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Open live leaderboard page</span>
            </Link>
            <Link 
              href="/referee"
              className="p-4 bg-black hover:bg-zinc-900/30 border border-zinc-855 hover:border-white rounded-xl text-center group transition-all"
            >
              <span className="text-white group-hover:underline font-semibold block text-xs uppercase tracking-wider">Referee Portal</span>
              <span className="text-[10px] text-zinc-500 block mt-1">Access mobile-first scoring scorecard</span>
            </Link>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: "Divisions", value: divisionsCount, icon: Layers, color: "text-white bg-zinc-950 border-zinc-855 hover:border-zinc-700" },
            { label: "Courts", value: courtsCount, icon: MapPin, color: "text-white bg-zinc-955 border-zinc-855 hover:border-zinc-700" },
            { label: "Teams", value: teamsCount, icon: Users, color: "text-white bg-zinc-955 border-zinc-855 hover:border-zinc-700" },
            { label: "Players", value: playersCount, icon: FolderGit2, color: "text-white bg-zinc-955 border-zinc-855 hover:border-zinc-700" },
            { label: "Matches", value: matchesCount, icon: Activity, color: "text-white bg-zinc-955 border-zinc-855 hover:border-zinc-700" },
          ].map((stat, i) => (
            <div key={i} className={`p-4 rounded-xl border ${stat.color} flex flex-col justify-between shadow-sm transition-all`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="w-4 h-4 opacity-60" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-white font-mono leading-none">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Live Courts Overview */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center space-x-2">
              <Activity className="w-4 h-4 text-white" />
              <span>Court Monitor (Real-time)</span>
            </h3>
            <span className="text-[11px] text-zinc-550 font-medium">Active matches currently on courts</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {tournament.courts.map((court) => {
              const activeMatch = court.matches[0];
              const isOccupied = !!activeMatch;

              return (
                <div key={court.id} className={`bg-zinc-950 border rounded-xl p-4 flex flex-col justify-between shadow-sm min-h-[160px] transition-all hover:border-zinc-700 ${isOccupied ? "border-2 border-white" : "border-zinc-855"}`}>
                  <div className="flex items-center justify-between border-b border-zinc-855 pb-2.5">
                    <span className="font-bold text-xs text-zinc-200">{court.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase ${
                      isOccupied ? "bg-white text-black border border-white" : "bg-black border border-zinc-800 text-zinc-550"
                    }`}>
                      {isOccupied ? "Occupied" : "Available"}
                    </span>
                  </div>

                  {isOccupied ? (
                    <div className="mt-3 space-y-3">
                      <div className="text-[9px] text-white font-bold font-mono uppercase tracking-wider">
                        {activeMatch.round} • {activeMatch.winnerId ? "Completed" : "In Progress"}
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className={activeMatch.winnerId === activeMatch.teamAId ? "text-white font-bold underline" : "text-zinc-300"}>
                            {activeMatch.teamA.name}
                          </span>
                          <span className="text-zinc-300 font-mono text-[11px] bg-black px-1.5 py-0.5 rounded border border-zinc-850">
                            {activeMatch.games.map(g => g.teamAScore).join(" | ")}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className={activeMatch.winnerId === activeMatch.teamBId ? "text-white font-bold underline" : "text-zinc-300"}>
                            {activeMatch.teamB.name}
                          </span>
                          <span className="text-zinc-300 font-mono text-[11px] bg-black px-1.5 py-0.5 rounded border border-zinc-855">
                            {activeMatch.games.map(g => g.teamBScore).join(" | ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-zinc-650 text-xs italic h-full py-4">
                      No active match scheduled
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Live / Pending Matches List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
              Active Tournament Matches
            </h3>
            <span className="text-xs text-zinc-550 font-medium">{activeMatches.length} matches active</span>
          </div>

          {activeMatches.length === 0 ? (
            <div className="bg-zinc-950 border border-zinc-855 rounded-xl p-8 text-center text-zinc-555 text-xs italic">
              No matches currently in progress. Start matches in the referee scorecard or override scores below.
            </div>
          ) : (
            <div className="bg-zinc-955 border border-zinc-855 rounded-xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-855 bg-black text-[10px] font-bold text-zinc-450 uppercase tracking-wider">
                      <th className="py-4 px-6">Court</th>
                      <th className="py-4 px-6">Division</th>
                      <th className="py-4 px-6">Round</th>
                      <th className="py-4 px-6">Teams & Current Game Score</th>
                      <th className="py-4 px-6">Status</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-850 text-xs">
                    {activeMatches.map((match) => {
                      const activeGame = match.games.find((g) => g.status === "IN_PROGRESS") || match.games[match.games.length - 1];
                      const isDisputed = match.status === "DISPUTED";

                      return (
                        <tr key={match.id} className="hover:bg-zinc-900/10 transition-colors">
                          <td className="py-4 px-6 font-semibold text-zinc-200">
                            {match.court?.name || "Unassigned"}
                          </td>
                          <td className="py-4 px-6 text-zinc-400">
                            {match.division.name}
                          </td>
                          <td className="py-4 px-6 font-mono text-[10px] text-zinc-550">
                            {match.round || "—"}
                          </td>
                          <td className="py-4 px-6">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between max-w-[200px]">
                                <span className="font-semibold text-zinc-350">{match.teamA.name}</span>
                                <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white font-bold border border-zinc-850 text-[10px]">
                                  {activeGame ? activeGame.teamAScore : 0}
                                </span>
                              </div>
                              <div className="flex items-center justify-between max-w-[200px]">
                                <span className="font-semibold text-zinc-350">{match.teamB.name}</span>
                                <span className="font-mono bg-black px-1.5 py-0.5 rounded text-white font-bold border border-zinc-855 text-[10px]">
                                  {activeGame ? activeGame.teamBScore : 0}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase ${
                              isDisputed 
                                ? "bg-black text-white border-2 border-dashed border-white animate-pulse" 
                                : "bg-white text-black font-extrabold border border-white"
                            }`}>
                              {isDisputed && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {match.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <Link 
                              href="/admin/matches" 
                              className="inline-flex items-center text-xs text-white hover:text-zinc-200 font-bold underline"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              Manage Match
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
