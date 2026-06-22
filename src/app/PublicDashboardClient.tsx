"use client";

import { useState, useEffect } from "react";
import { 
  Trophy, 
  MapPin, 
  Activity, 
  Layers, 
  ShieldCheck, 
  Maximize2, 
  Calendar, 
  Search, 
  Tv, 
  ChevronRight,
  Crown
} from "lucide-react";
import Link from "next/link";

interface TeamStanding {
  id: string;
  name: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  gamesWon: number;
  gamesLost: number;
  pointDiff: number;
}

interface MatchData {
  id: string;
  status: string;
  round: string | null;
  scheduledTime: string | null;
  court: { name: string } | null;
  division: { id: string; name: string };
  teamA: { id: string; name: string | null };
  teamB: { id: string; name: string | null };
  winnerId: string | null;
  games: Array<{
    id: string;
    gameNumber: number;
    teamAScore: number;
    teamBScore: number;
    status: string;
  }>;
}

interface CourtData {
  id: string;
  name: string;
  matches: Array<{
    id: string;
    round: string | null;
    teamA: { name: string | null };
    teamB: { name: string | null };
    games: Array<{
      teamAScore: number;
      teamBScore: number;
    }>;
  }>;
}

interface PublicDashboardProps {
  initialData: {
    tournament: {
      id: string;
      name: string;
      location: string | null;
      startDate: string;
      endDate: string;
      status: string;
      divisions: Array<{ id: string; name: string }>;
      courts: CourtData[];
    };
    standings: Record<string, TeamStanding[]>;
    matches: MatchData[];
  };
}

export default function PublicDashboardClient({ initialData }: PublicDashboardProps) {
  // Local state
  const [tournament, setTournament] = useState(initialData.tournament);
  const [standings, setStandings] = useState(initialData.standings);
  const [matches, setMatches] = useState(initialData.matches);
  
  const [activeTab, setActiveTab] = useState<"standings" | "matches" | "courts">("standings");
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>(
    tournament.divisions[0]?.id || ""
  );
  const [matchFilter, setMatchFilter] = useState<"all" | "live" | "scheduled" | "completed">("all");
  
  // Calculate live stats summary for open dashboard clarity
  const liveCount = matches.filter(m => m.status === "IN_PROGRESS" || m.status === "DISPUTED").length;
  const activeCourtsCount = tournament.courts.filter(c => 
    matches.some(m => m.court?.name === c.name && (m.status === "IN_PROGRESS" || m.status === "DISPUTED" || m.status === "PAUSED"))
  ).length;
  const scheduledCount = matches.filter(m => m.status === "SCHEDULED").length;
  const completedCount = matches.filter(m => m.status === "COMPLETED").length;
  
  // Real-time synchronization via Server-Sent Events (SSE)
  useEffect(() => {
    const sseChannel = `tournament:${tournament.id}`;
    const eventSource = new EventSource(`/api/live?channel=${sseChannel}`);

    const handleUpdate = async () => {
      console.log("[SSE] Tournament update received. Fetching latest data...");
      try {
        const res = await fetch(`/api/tournament/${tournament.id}/public-data`);
        if (res.ok) {
          const freshData = await res.json();
          setTournament(freshData.tournament);
          setStandings(freshData.standings);
          setMatches(freshData.matches);
        }
      } catch (err) {
        console.error("Failed to fetch fresh data after SSE update:", err);
      }
    };

    eventSource.addEventListener("match_update", handleUpdate);
    eventSource.addEventListener("tournament_reset", handleUpdate);

    return () => {
      eventSource.close();
    };
  }, [tournament.id]);

  // Filters matches based on active filters
  const filteredMatches = matches.filter((m) => {
    // Division filter
    if (activeTab === "standings" && m.division.id !== selectedDivisionId) return false;
    
    // Status filter
    if (matchFilter === "live") return m.status === "IN_PROGRESS" || m.status === "DISPUTED";
    if (matchFilter === "scheduled") return m.status === "SCHEDULED";
    if (matchFilter === "completed") return m.status === "COMPLETED";
    
    return true;
  });

  const selectedDivisionStandings = standings[selectedDivisionId] || [];
  const selectedDivision = tournament.divisions.find(d => d.id === selectedDivisionId);

  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col antialiased">
      {/* Top Banner Header */}
      <header className="border-b border-zinc-800 bg-black/85 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-none tracking-tight">Antigravity Scoring</h1>
            <span className="text-[9px] text-white font-semibold tracking-wider uppercase flex items-center mt-1 font-mono">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping mr-1.5"></span>
              Live Standing
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <Link
            href="/brackets"
            className="text-xs font-semibold text-zinc-400 hover:text-white underline transition-colors hidden sm:block"
          >
            Bracket View
          </Link>
          <Link
            href="/login"
            className="border border-zinc-850 bg-zinc-950 hover:bg-white hover:text-black text-zinc-300 rounded-xl py-2 px-4 font-semibold text-xs transition-all flex items-center space-x-1"
          >
            <span>Staff Login</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        
        {/* Tournament Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-850 bg-zinc-950 p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-black uppercase tracking-widest">
              {tournament.status} event
            </span>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              {tournament.name}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-zinc-400 text-xs font-medium">
              <span className="flex items-center"><MapPin className="w-3.5 h-3.5 mr-1.5 text-zinc-500" /> {tournament.location}</span>
              <span className="text-zinc-700">•</span>
              <span>{new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}</span>
            </div>
          </div>

          <Link
            href="/brackets"
            className="bg-white hover:bg-zinc-200 text-black rounded-xl py-3 px-5 font-bold text-xs transition-all flex items-center justify-center space-x-2 self-start md:self-auto shadow-sm"
          >
            <Tv className="w-4 h-4" />
            <span>Interactive Bracket</span>
          </Link>
        </div>

        {/* Live Metrics Bar for Open Dashboard Clarity */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-1">Live Matches</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2 h-2 bg-white rounded-full animate-ping"></span>
              <span className="text-lg font-semibold text-zinc-200 font-mono leading-none">{liveCount}</span>
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-1">Active Courts</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2 h-2 bg-zinc-405 rounded-full"></span>
              <span className="text-lg font-semibold text-zinc-200 font-mono leading-none">{activeCourtsCount} / {tournament.courts.length}</span>
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-1">Scheduled Matches</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2 h-2 bg-zinc-650 rounded-full"></span>
              <span className="text-lg font-semibold text-zinc-200 font-mono leading-none">{scheduledCount}</span>
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-850 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider block mb-1">Completed Matches</span>
            <div className="flex items-center space-x-2 mt-1">
              <span className="w-2 h-2 bg-zinc-800 rounded-full"></span>
              <span className="text-lg font-semibold text-zinc-200 font-mono leading-none">{completedCount}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-900">
          {[
            { id: "standings", label: "Leaderboard & Standings", icon: Trophy },
            { id: "matches", label: "Match Schedule & Results", icon: Calendar },
            { id: "courts", label: "Live Court Status", icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-4 px-6 border-b-2 font-semibold text-sm transition-all -mb-px ${
                activeTab === tab.id
                  ? "border-white text-white bg-zinc-900/40"
                  : "border-transparent text-zinc-505 hover:text-zinc-300"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Leaderboard Standings */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            {/* Division Selector */}
            <div className="flex items-center justify-between flex-wrap gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
              <div className="flex items-center space-x-3">
                <Layers className="w-5 h-5 text-white" />
                <span className="text-sm font-semibold text-zinc-300">Select Division:</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {tournament.divisions.map((div) => (
                  <button
                    key={div.id}
                    onClick={() => setSelectedDivisionId(div.id)}
                    className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all ${
                      selectedDivisionId === div.id
                        ? "bg-white text-black border-white"
                        : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {div.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Standings Table */}
            {selectedDivisionStandings.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-12 text-center text-zinc-500 italic">
                No teams registered in this division.
              </div>
            ) : (
              <div className="bg-zinc-950 border border-zinc-850 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-zinc-850 bg-zinc-950 flex justify-between items-center">
                  <h3 className="font-bold text-zinc-200 text-sm">
                    Standings — {selectedDivision?.name}
                  </h3>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono font-medium">
                    Updated live
                  </span>
                </div>

                {/* Standings glossary/legend for first-time viewers */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-zinc-500 text-[10px] px-6 py-2 bg-black border-b border-zinc-850">
                  <span className="flex items-center"><span className="w-4 h-4 bg-zinc-900 border border-zinc-700 text-white font-bold px-1 rounded mr-1 flex items-center justify-center">W</span> Wins</span>
                  <span className="flex items-center"><span className="w-4 h-4 bg-black border border-zinc-800 text-zinc-405 font-bold px-1 rounded mr-1 flex items-center justify-center">L</span> Losses</span>
                  <span className="flex items-center"><strong>Games W/L:</strong> Games Won / Games Lost</span>
                  <span className="flex items-center"><strong>Point Diff:</strong> Overall Point Differential (Primary Tiebreaker)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-850 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-950">
                        <th className="py-4 px-6 text-center w-16">Rank</th>
                        <th className="py-4 px-6">Team</th>
                        <th className="py-4 px-6 text-center">Played</th>
                        <th className="py-4 px-6 text-center">W</th>
                        <th className="py-4 px-6 text-center">L</th>
                        <th className="py-4 px-6 text-center">Games W/L</th>
                        <th className="py-4 px-6 text-center">Point Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850 text-sm">
                      {selectedDivisionStandings.map((standing, index) => {
                        const isLeader = index === 0;
                        return (
                          <tr 
                            key={standing.id} 
                            className={`hover:bg-zinc-900/10 transition-colors ${
                              isLeader ? "bg-zinc-900/25" : ""
                            }`}
                          >
                            <td className="py-4 px-6 text-center font-bold font-mono">
                              {isLeader ? (
                                <Crown className="w-4 h-4 text-white mx-auto" />
                              ) : (
                                index + 1
                              )}
                            </td>
                            <td className="py-4 px-6 font-bold text-zinc-200 flex items-center space-x-2">
                              <span>{standing.name}</span>
                              {isLeader && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] bg-white text-black border border-white font-bold tracking-wider uppercase">
                                  Leader
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center font-mono text-zinc-300">
                              {standing.matchesPlayed}
                            </td>
                            <td className="py-4 px-6 text-center font-bold font-mono text-white">
                              {standing.wins}
                            </td>
                            <td className="py-4 px-6 text-center font-bold font-mono text-zinc-400">
                              {standing.losses}
                            </td>
                            <td className="py-4 px-6 text-center font-mono text-zinc-400">
                              {standing.gamesWon} - {standing.gamesLost}
                            </td>
                            <td className="py-4 px-6 text-center font-mono font-bold text-zinc-200">
                              {standing.pointDiff > 0 ? `+${standing.pointDiff}` : standing.pointDiff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Tab 2: Match Schedule */}
        {activeTab === "matches" && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
              <div className="flex gap-2">
                {[
                  { id: "all", label: "All Matches" },
                  { id: "live", label: "Live Scorecards" },
                  { id: "scheduled", label: "Scheduled Only" },
                  { id: "completed", label: "Results / Completed" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setMatchFilter(filter.id as any)}
                    className={`py-2 px-4 rounded-xl text-xs font-semibold border transition-all ${
                      matchFilter === filter.id
                        ? "bg-white text-black border-white"
                        : "bg-black border-zinc-800 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Matches Display Grid */}
            {filteredMatches.length === 0 ? (
              <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-12 text-center text-zinc-500 italic">
                No matches match this filter status.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredMatches.map((m) => {
                  const isLive = m.status === "IN_PROGRESS" || m.status === "DISPUTED";
                  const isCompleted = m.status === "COMPLETED";
                  const activeGame = m.games.find(g => g.status === "IN_PROGRESS") || m.games[m.games.length - 1];

                  return (
                    <div 
                      key={m.id}
                      className={`p-5 rounded-2xl border transition-all duration-200 hover:border-zinc-800 flex flex-col justify-between min-h-[190px] ${
                        isLive 
                          ? "bg-black border-2 border-white" 
                          : "bg-zinc-950 border border-zinc-850"
                      }`}
                    >
                      <div>
                        {/* Upper Metadata */}
                        <div className="flex justify-between items-center border-b border-zinc-850 pb-3 mb-4">
                          <span className="text-[10px] font-bold font-mono text-white uppercase tracking-wider">
                            {m.court?.name || "No Court Assigned"} • {m.round}
                          </span>
                          
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wide uppercase ${
                            m.status === "DISPUTED"
                              ? "bg-black text-white border border-dashed border-white animate-pulse"
                              : isLive
                              ? "bg-white text-black font-extrabold border border-white"
                              : m.status === "COMPLETED"
                              ? "bg-zinc-900 border border-zinc-800 text-zinc-400"
                              : "bg-zinc-900 border border-zinc-800 text-zinc-550"
                          }`}>
                            {m.status === "IN_PROGRESS" ? "Live" : m.status}
                          </span>
                        </div>

                        {/* Team Scores */}
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2">
                              {isCompleted && m.winnerId === m.teamA.id && (
                                <Crown className="w-3.5 h-3.5 text-white" />
                              )}
                              <span className={`font-medium ${
                                m.winnerId === m.teamA.id ? "text-white font-bold underline" : "text-zinc-300"
                              }`}>
                                {m.teamA.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-semibold bg-black border border-zinc-805 px-2 py-0.5 rounded text-zinc-200">
                              {activeGame ? activeGame.teamAScore : 0}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <div className="flex items-center space-x-2">
                              {isCompleted && m.winnerId === m.teamB.id && (
                                <Crown className="w-3.5 h-3.5 text-white" />
                              )}
                              <span className={`font-medium ${
                                m.winnerId === m.teamB.id ? "text-white font-bold underline" : "text-zinc-300"
                              }`}>
                                {m.teamB.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-semibold bg-black border border-zinc-805 px-2 py-0.5 rounded text-zinc-200">
                              {activeGame ? activeGame.teamBScore : 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score history & action link */}
                      <div className="mt-5 pt-3 border-t border-zinc-850 flex items-center justify-between">
                        <span className="text-[9px] text-zinc-550 font-medium uppercase tracking-wider">
                          {m.division.name}
                        </span>

                        <Link
                          href={`/match/${m.id}`}
                          className="inline-flex items-center text-[11px] font-semibold text-white hover:text-zinc-300 underline"
                        >
                          <span>{isLive ? "View Live Scoreboard" : "View Scorecard"}</span>
                          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Court Status Board */}
        {activeTab === "courts" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournament.courts.map((court) => {
                // Find all active matches on this court
                const activeMatch = matches.find(
                  (m) => m.court?.name === court.name && (m.status === "IN_PROGRESS" || m.status === "DISPUTED" || m.status === "PAUSED")
                );
                
                const isOccupied = !!activeMatch;

                return (
                  <div 
                    key={court.id} 
                    className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 flex flex-col justify-between shadow-sm min-h-[220px]"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                      <span className="font-bold text-lg text-white">{court.name}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isOccupied ? "bg-white text-black border border-white" : "bg-black border border-zinc-800 text-zinc-550"
                      }`}>
                        {isOccupied ? "Match Live" : "Available"}
                      </span>
                    </div>

                    {isOccupied ? (
                      <div className="space-y-4 my-4">
                        <div className="text-[10px] text-white font-bold uppercase font-mono tracking-widest">
                          {activeMatch.round} • {activeMatch.division.name}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-zinc-350">{activeMatch.teamA.name}</span>
                            <span className="font-mono text-zinc-200 font-bold bg-black px-2 py-0.5 rounded border border-zinc-800">
                              {activeMatch.games.map((g) => g.teamAScore).join(" | ")}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-zinc-350">{activeMatch.teamB.name}</span>
                            <span className="font-mono text-zinc-200 font-bold bg-black px-2 py-0.5 rounded border border-zinc-800">
                              {activeMatch.games.map((g) => g.teamBScore).join(" | ")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-zinc-650 text-sm italic h-full py-8">
                        No active match scheduled
                      </div>
                    )}

                    {isOccupied && (
                      <Link
                        href={`/match/${activeMatch.id}`}
                        className="w-full bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl py-2 px-3 text-center text-xs font-semibold transition-all"
                      >
                        Monitor Live Scores
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>
      {/* Footer */}
      <footer className="border-t border-zinc-850 bg-black p-6 text-center text-xs text-zinc-500 mt-12">
        <p className="font-medium text-zinc-400">Antigravity Tournament Scoring Platform</p>
        <p className="mt-1">Powered by Next.js Server-Sent Events & Prisma. Sync time &copy; 2026.</p>
      </footer>
    </div>
  );
}
