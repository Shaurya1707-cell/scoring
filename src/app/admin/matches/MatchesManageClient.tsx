"use client";

import { useState, useTransition } from "react";
import { 
  adminOverrideScoreAction, 
  toggleMatchDisputeAction 
} from "@/app/actions/adminActions";
import { 
  AlertTriangle, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Save, 
  History, 
  UserCheck, 
  Flame, 
  Clock 
} from "lucide-react";

interface MatchData {
  id: string;
  status: string;
  round: string | null;
  scheduledTime: Date | null;
  division: {
    name: string;
    scoringType: string;
  };
  court: {
    name: string;
  } | null;
  teamA: {
    id: string;
    name: string | null;
  };
  teamB: {
    id: string;
    name: string | null;
  };
  winnerId: string | null;
  games: Array<{
    id: string;
    gameNumber: number;
    teamAScore: number;
    teamBScore: number;
    servingTeamId: string | null;
    serverNumber: number | null;
    status: string;
  }>;
}

interface AuditLogData {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  performedBy: {
    name: string;
  };
}

export default function MatchesManageClient({
  matches,
  auditLogs,
  adminId
}: {
  matches: MatchData[];
  auditLogs: AuditLogData[];
  adminId: string;
}) {
  const [selectedMatchId, setSelectedMatchId] = useState<string>(matches[0]?.id || "");
  const [selectedGameTab, setSelectedGameTab] = useState<number>(0);
  const [isPending, startTransition] = useTransition();

  // Selected match details
  const match = matches.find((m) => m.id === selectedMatchId);
  const logs = auditLogs.filter(
    (log) => log.entityId === selectedMatchId || match?.games.some((g) => g.id === log.entityId)
  );

  // Form states for selected game override
  const selectedGame = match?.games[selectedGameTab] || match?.games[0];
  const [scoreA, setScoreA] = useState(selectedGame?.teamAScore || 0);
  const [scoreB, setScoreB] = useState(selectedGame?.teamBScore || 0);
  const [servingTeamId, setServingTeamId] = useState<string>(selectedGame?.servingTeamId || "null");
  const [serverNumber, setServerNumber] = useState<number>(selectedGame?.serverNumber || 1);

  const applyPresetScore = (a: number, b: number) => {
    setScoreA(a);
    setScoreB(b);
  };

  // Synchronize form when selected game or match changes
  const syncForm = (game: typeof selectedGame) => {
    if (game) {
      setScoreA(game.teamAScore);
      setScoreB(game.teamBScore);
      setServingTeamId(game.servingTeamId || "null");
      setServerNumber(game.serverNumber || 1);
    }
  };

  const handleMatchSelect = (matchId: string) => {
    setSelectedMatchId(matchId);
    const m = matches.find((x) => x.id === matchId);
    if (m && m.games.length > 0) {
      setSelectedGameTab(0);
      syncForm(m.games[0]);
    }
  };

  const handleGameTabChange = (index: number) => {
    setSelectedGameTab(index);
    if (match) {
      syncForm(match.games[index]);
    }
  };

  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!match || !selectedGame) return;

    startTransition(async () => {
      const res = await adminOverrideScoreAction({
        matchId: match.id,
        gameId: selectedGame.id,
        teamAScore: Number(scoreA),
        teamBScore: Number(scoreB),
        servingTeamId: servingTeamId === "null" ? null : servingTeamId,
        serverNumber: servingTeamId === "null" ? null : Number(serverNumber),
        adminId
      });

      if (res?.error) {
        alert("Failed to override score: " + res.error);
      } else {
        alert("Score overridden successfully!");
      }
    });
  };

  const handleToggleDispute = async (status: "DISPUTED" | "IN_PROGRESS" | "COMPLETED") => {
    if (!match) return;

    startTransition(async () => {
      const res = await toggleMatchDisputeAction(match.id, status, adminId);
      if (res?.error) {
        alert("Failed to update status: " + res.error);
      } else {
        alert(`Match status updated to ${status}!`);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Match Selection */}
      <div className="lg:col-span-4 space-y-4">
        <h3 className="font-semibold text-zinc-400 text-xs uppercase tracking-wider block">
          Select Match
        </h3>

        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {matches.map((m) => {
            const isSelected = m.id === selectedMatchId;
            const isDisputed = m.status === "DISPUTED";
            const isCompleted = m.status === "COMPLETED";

            return (
              <button
                key={m.id}
                onClick={() => handleMatchSelect(m.id)}
                className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 hover:scale-[1.01] ${
                  isSelected
                    ? "bg-black border-2 border-white shadow-sm"
                    : "bg-black border border-zinc-850 opacity-60 hover:opacity-100"
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono font-bold text-zinc-500 uppercase">
                    {m.court?.name || "Unassigned"} • {m.round}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                    isDisputed 
                      ? "bg-black text-white border-2 border-dashed border-white animate-pulse" 
                      : isCompleted
                      ? "bg-white text-black border border-white"
                      : "bg-zinc-900 text-white border border-zinc-800"
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="space-y-1 mt-2">
                  <div className="flex justify-between text-sm">
                    <span className={`font-semibold ${m.winnerId === m.teamA.id ? "text-white font-bold underline" : "text-zinc-200"}`}>
                      {m.teamA.name}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {m.games.map(g => g.teamAScore).join("-")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className={`font-semibold ${m.winnerId === m.teamB.id ? "text-white font-bold underline" : "text-zinc-200"}`}>
                      {m.teamB.name}
                    </span>
                    <span className="font-mono text-zinc-400">
                      {m.games.map(g => g.teamBScore).join("-")}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] text-zinc-500 mt-3 pt-2 border-t border-zinc-850/50 flex justify-between">
                  <span>{m.division.name}</span>
                  <span className="capitalize">{m.division.scoringType.toLowerCase()} Scoring</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Manage Selected Match */}
      <div className="lg:col-span-8 space-y-6">
        {match ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className={`border rounded-2xl p-6 relative overflow-hidden ${
              match.status === "DISPUTED"
                ? "bg-black border-2 border-dashed border-white"
                : "bg-zinc-950 border border-zinc-850"
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center">
                    {match.status === "DISPUTED" && <AlertTriangle className="w-5 h-5 text-white mr-2 animate-pulse" />}
                    {match.teamA.name} <span className="text-zinc-550 font-normal mx-2">vs</span> {match.teamB.name}
                  </h3>
                  <p className="text-zinc-500 text-xs mt-1">
                    {match.division.name} • {match.court?.name || "No Court"} • {match.round}
                  </p>
                </div>

                {/* Dispute / Locking Actions */}
                <div className="flex items-center gap-2">
                  {match.status === "DISPUTED" ? (
                    <button
                      onClick={() => handleToggleDispute("IN_PROGRESS")}
                      disabled={isPending}
                      className="bg-white hover:bg-zinc-200 text-black border border-white rounded-xl py-2.5 px-4 font-bold text-xs transition-all flex items-center space-x-1.5 shadow-sm"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      <span>Resolve Dispute (Unlock Referee)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleDispute("DISPUTED")}
                      disabled={isPending}
                      className="bg-black hover:bg-zinc-900 border border-white text-white rounded-xl py-2.5 px-4 font-bold text-xs transition-all flex items-center space-x-1.5"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Flag Dispute (Lock Match)</span>
                    </button>
                  )}
                </div>
              </div>

              {match.status === "DISPUTED" && (
                <div className="mt-4 p-3 rounded-lg border border-dashed border-white bg-black text-xs text-white font-medium">
                  Dispute Flagged: Referee inputs have been locked. Use the override tools below to reconcile scores, then click "Resolve Dispute" to resume.
                </div>
              )}
            </div>

            {/* Scorecard Edit Panel */}
            <div className="bg-zinc-955 border border-zinc-850 rounded-3xl p-6 space-y-6">
              <div className="border-b border-zinc-850 pb-4">
                <h4 className="font-bold text-white">Override Scores</h4>
                <p className="text-zinc-450 text-xs mt-1">Manually force-set scores and serving indicators for any game in this match</p>
              </div>

              {/* Game Tabs */}
              <div className="flex gap-2">
                {match.games.map((g, i) => (
                  <button
                    key={g.id}
                    onClick={() => handleGameTabChange(i)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      selectedGameTab === i
                        ? "bg-white text-black border-white"
                        : "bg-black border-zinc-800 text-zinc-405 hover:text-white"
                    }`}
                  >
                    Game {g.gameNumber} {g.status === "COMPLETED" ? "✓" : "•"}
                  </button>
                ))}
              </div>

              {selectedGame ? (
                <form onSubmit={handleOverrideSubmit} className="space-y-6">
                  {/* Preset Buttons for Admin Convenience */}
                  <div className="bg-black p-4 rounded-xl border border-zinc-850 space-y-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Score Presets</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => applyPresetScore(0, 0)}
                        className="py-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        Reset (0-0)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetScore(11, 9)}
                        className="py-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        11 - 9
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetScore(11, 10)}
                        className="py-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        11 - 10
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetScore(15, 13)}
                        className="py-1 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-300 hover:border-zinc-700 transition-all cursor-pointer"
                      >
                        15 - 13
                      </button>
                    </div>
                  </div>

                  {/* Scores Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black p-4 rounded-xl border border-zinc-850 space-y-3">
                      <label className="text-xs font-semibold text-zinc-400 block">{match.teamA.name} Score</label>
                      <input
                        type="number"
                        min="0"
                        value={scoreA}
                        onChange={(e) => setScoreA(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 font-mono font-bold text-xl text-white focus:outline-none focus:border-white"
                      />
                    </div>
                    <div className="bg-black p-4 rounded-xl border border-zinc-850 space-y-3">
                      <label className="text-xs font-semibold text-zinc-400 block">{match.teamB.name} Score</label>
                      <input
                        type="number"
                        min="0"
                        value={scoreB}
                        onChange={(e) => setScoreB(Number(e.target.value))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 font-mono font-bold text-xl text-white focus:outline-none focus:border-white"
                      />
                    </div>
                  </div>

                  {/* Serving Controls (Traditional Only) */}
                  {match.division.scoringType === "TRADITIONAL" && (
                    <div className="bg-black p-5 rounded-2xl border border-zinc-850 space-y-4">
                      <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Serve Configuration</h5>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs text-zinc-500 block">Serving Team</label>
                          <select
                            value={servingTeamId}
                            onChange={(e) => setServingTeamId(e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-zinc-200 focus:outline-none focus:border-white"
                          >
                            <option value="null">None (Not Serving)</option>
                            <option value={match.teamA.id}>{match.teamA.name}</option>
                            <option value={match.teamB.id}>{match.teamB.name}</option>
                          </select>
                        </div>

                        {servingTeamId !== "null" && (
                          <div className="space-y-2">
                            <label className="text-xs text-zinc-505 block">Server Number</label>
                            <select
                              value={serverNumber}
                              onChange={(e) => setServerNumber(Number(e.target.value))}
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 px-3 text-sm text-zinc-200 focus:outline-none focus:border-white"
                            >
                              <option value={1}>Server 1</option>
                              <option value={2}>Server 2</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-white hover:bg-zinc-200 text-black rounded-xl py-3 font-bold text-sm transition-all shadow-sm flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Override Score</span>
                  </button>
                </form>
              ) : (
                <div className="text-zinc-550 italic text-sm">No games configured for this match.</div>
              )}
            </div>

            {/* Audit Log Panel */}
            <div className="bg-zinc-955 border border-zinc-850 rounded-3xl p-6 space-y-4">
              <div className="border-b border-zinc-850 pb-3 flex items-center space-x-2">
                <History className="w-5 h-5 text-white" />
                <h4 className="font-bold text-zinc-200">Score Audit Trail</h4>
              </div>

              {logs.length === 0 ? (
                <div className="text-zinc-650 italic text-xs py-4 text-center">No overrides or updates logged for this match yet.</div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {logs.map((log) => {
                    const oldVal = log.oldValue ? JSON.parse(log.oldValue) : null;
                    const newVal = log.newValue ? JSON.parse(log.newValue) : null;

                    return (
                      <div key={log.id} className="p-3 bg-black border border-zinc-850 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between text-zinc-400">
                          <span className="font-bold text-white flex items-center">
                            <UserCheck className="w-3.5 h-3.5 mr-1" />
                            {log.performedBy.name}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-600">
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-zinc-300">
                          Performed <code className="text-white underline">{log.action}</code> override.
                        </p>
                        {oldVal && newVal && (
                          <div className="text-zinc-500 text-[10px] font-mono mt-1 pt-1 border-t border-zinc-900">
                            Old: {oldVal.teamAScore}-{oldVal.teamBScore} | New: {newVal.teamAScore}-{newVal.teamBScore}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="bg-zinc-950 border border-zinc-855 rounded-3xl p-12 text-center text-zinc-500 italic">
            Select a match to override scores and manage dispute flags.
          </div>
        )}
      </div>
    </div>
  );
}

