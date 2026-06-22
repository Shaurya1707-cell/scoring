"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calculateNextState } from "@/lib/rules";
import { 
  queuePointAction, 
  queueUndoAction, 
  syncOfflineQueue, 
  offlineDB 
} from "@/lib/offlineQueue";
import { useLiveQuery } from "dexie-react-hooks";
import { 
  Wifi, 
  WifiOff, 
  RotateCcw, 
  Check, 
  ShieldAlert, 
  ArrowLeft, 
  ChevronRight, 
  HelpCircle 
} from "lucide-react";
import Link from "next/link";

interface ScorecardClientProps {
  initialMatch: {
    id: string;
    status: string;
    round: string | null;
    teamAId: string;
    teamBId: string;
    teamA: { name: string | null };
    teamB: { name: string | null };
    division: {
      name: string;
      scoringType: "RALLY" | "TRADITIONAL";
    };
    pointsToWin: number;
    winBy: number;
    games: Array<{
      id: string;
      gameNumber: number;
      teamAScore: number;
      teamBScore: number;
      servingTeamId: string | null;
      serverNumber: number | null;
      status: string;
    }>;
  };
  isDoubles: boolean;
}

export default function ScorecardClient({ initialMatch, isDoubles }: ScorecardClientProps) {
  const router = useRouter();
  
  // Active game logic
  const initialGame = initialMatch.games.find(g => g.status === "IN_PROGRESS") || initialMatch.games[initialMatch.games.length - 1];
  
  // State variables
  const [matchStatus, setMatchStatus] = useState(initialMatch.status);
  const [game, setGame] = useState(initialGame);
  const [isOnline, setIsOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Monitor the offline Dexie queue size
  const pendingActionsCount = useLiveQuery(
    () => offlineDB.pendingActions.where("matchId").equals(initialMatch.id).count(),
    [initialMatch.id]
  ) || 0;

  // Track online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Set up Server-Sent Events (SSE) listener for real-time overrides from admin
  useEffect(() => {
    const sseChannel = `match:${initialMatch.id}`;
    const eventSource = new EventSource(`/api/live?channel=${sseChannel}`);

    eventSource.addEventListener("score_update", (e: any) => {
      try {
        const data = JSON.parse(e.data);
        if (data.gameId === game.id) {
          // If we have local unsynced actions, let's keep them and NOT overwrite with server scores yet,
          // or we reconcile. But if we are online and have no pending items, update state directly.
          if (pendingActionsCount === 0) {
            setGame(prev => ({
              ...prev,
              teamAScore: data.teamAScore,
              teamBScore: data.teamBScore,
              servingTeamId: data.servingTeamId,
              serverNumber: data.serverNumber,
              status: data.gameStatus,
            }));
            setMatchStatus(data.matchStatus);
          }
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    });

    eventSource.addEventListener("status_update", (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setMatchStatus(data.status);
        if (data.status === "DISPUTED") {
          setError("This match is locked by an admin due to a dispute.");
        } else {
          setError(null);
        }
      } catch (err) {
        console.error("SSE status parse error:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [initialMatch.id, game.id, pendingActionsCount]);

  // Sync handler
  const handleSync = async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    setError(null);
    try {
      await syncOfflineQueue();
      // Fetch latest state from server after syncing
      const res = await fetch(`/api/match/${initialMatch.id}`);
      if (res.ok) {
        const serverMatch = await res.json();
        const activeServerGame = serverMatch.games.find((g: any) => g.id === game.id) || serverMatch.games[serverMatch.games.length - 1];
        setGame(activeServerGame);
        setMatchStatus(serverMatch.status);
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setSyncing(false);
    }
  };

  // Submit point action (Rally or Traditional)
  const handleScorePoint = async (scoringTeamId: string) => {
    if (matchStatus === "DISPUTED") {
      setError("Match is locked by admin.");
      return;
    }

    if (game.status === "COMPLETED") {
      return;
    }

    // 1. Optimistic UI updates
    const nextState = calculateNextState({
      scoringTeamId,
      teamAId: initialMatch.teamAId,
      teamBId: initialMatch.teamBId,
      currentTeamAScore: game.teamAScore,
      currentTeamBScore: game.teamBScore,
      currentServingTeamId: game.servingTeamId,
      currentServerNumber: game.serverNumber,
      scoringType: initialMatch.division.scoringType,
      isDoubles,
      pointsToWin: initialMatch.pointsToWin,
      winBy: initialMatch.winBy,
    });

    // Save optimistic state locally
    const optimisticGame = {
      ...game,
      teamAScore: nextState.teamAScore,
      teamBScore: nextState.teamBScore,
      servingTeamId: nextState.servingTeamId,
      serverNumber: nextState.serverNumber,
      status: nextState.isGameFinished ? "COMPLETED" : "IN_PROGRESS",
    };
    setGame(optimisticGame);

    if (nextState.isGameFinished) {
      // If game ends, refresh router to load next game if needed
      setTimeout(() => {
        router.refresh();
      }, 1000);
    }

    // 2. Network Sync / Queueing
    if (isOnline) {
      try {
        const res = await fetch("/api/referee/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: initialMatch.id,
            gameId: game.id,
            scoringTeamId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to submit score");
        }

        const serverState = await res.json();
        // Set exact server state
        setGame(prev => ({
          ...prev,
          teamAScore: serverState.teamAScore,
          teamBScore: serverState.teamBScore,
          servingTeamId: serverState.servingTeamId,
          serverNumber: serverState.serverNumber,
          status: serverState.gameStatus,
        }));
        setMatchStatus(serverState.matchStatus);
      } catch (err: any) {
        setError(err.message);
        // Fall back to offline queuing if network fails mid-write
        await queuePointAction(initialMatch.id, game.id, scoringTeamId);
      }
    } else {
      // Offline queueing
      await queuePointAction(initialMatch.id, game.id, scoringTeamId);
    }
  };

  // Undo point action
  const handleUndo = async () => {
    if (matchStatus === "DISPUTED") {
      setError("Match is locked by admin.");
      return;
    }

    if (isOnline) {
      setSyncing(true);
      try {
        const res = await fetch("/api/referee/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: initialMatch.id,
            gameId: game.id,
          }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to undo point");
        }

        const serverState = await res.json();
        setGame(prev => ({
          ...prev,
          teamAScore: serverState.teamAScore,
          teamBScore: serverState.teamBScore,
          servingTeamId: serverState.servingTeamId,
          serverNumber: serverState.serverNumber,
          status: serverState.gameStatus,
        }));
        setMatchStatus(serverState.matchStatus);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSyncing(false);
      }
    } else {
      // Local optimistic undo (approximated, or wait for sync.
      // For simple offline undo, we queue it and decrement local score as an approximation)
      if (game.teamAScore > 0 || game.teamBScore > 0) {
        await queueUndoAction(initialMatch.id, game.id);
        // Optimistically reload/decrement locally
        setGame(prev => {
          // Decrement whichever score was higher or last updated
          const isDecA = prev.teamAScore > prev.teamBScore;
          return {
            ...prev,
            teamAScore: isDecA ? Math.max(0, prev.teamAScore - 1) : prev.teamAScore,
            teamBScore: !isDecA ? Math.max(0, prev.teamBScore - 1) : prev.teamBScore,
          };
        });
      }
    }
  };

  const isCompleted = matchStatus === "COMPLETED";
  const isDisputed = matchStatus === "DISPUTED";

  // Dynamic instruction text for first-time scorekeepers
  let teamAActionText = "Score +1 point";
  let teamBActionText = "Score +1 point";

  if (initialMatch.division.scoringType === "RALLY") {
    teamAActionText = "Awards point to Team A";
    teamBActionText = "Awards point to Team B";
  } else {
    // Traditional side-out rules
    if (game.servingTeamId === initialMatch.teamAId) {
      teamAActionText = "Awards +1 point (Serve held)";
      teamBActionText = isDoubles 
        ? (game.serverNumber === 1 ? "Switches to Server 2" : "Side-Out (Serve goes to Team B)")
        : "Side-Out (Serve goes to Team B)";
    } else if (game.servingTeamId === initialMatch.teamBId) {
      teamBActionText = "Awards +1 point (Serve held)";
      teamAActionText = isDoubles
        ? (game.serverNumber === 1 ? "Switches to Server 2" : "Side-Out (Serve goes to Team A)")
        : "Side-Out (Serve goes to Team A)";
    } else {
      teamAActionText = "Tap if Team A won rally";
      teamBActionText = "Tap if Team B won rally";
    }
  }
  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col max-w-md mx-auto border-x border-zinc-855 shadow-sm justify-between antialiased">
      
      {/* Mobile Header */}
      <header className="border-b border-zinc-855 bg-black/85 backdrop-blur-md px-4 py-3 flex items-center justify-between">
        <Link href="/referee" className="p-2 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        
        <div className="text-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-mono">
            Game {game.gameNumber} • {initialMatch.division.scoringType.toLowerCase()} scoring
          </span>
          <span className="text-xs font-bold text-zinc-300">
            {initialMatch.teamA.name} vs {initialMatch.teamB.name}
          </span>
        </div>

        {/* Connection status badge */}
        <div className="flex items-center">
          {isOnline ? (
            <span className="flex items-center text-[10px] text-black font-extrabold bg-white border border-white px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3 mr-1" />
              Online
            </span>
          ) : (
            <span className="flex items-center text-[10px] text-white font-extrabold bg-black border border-dashed border-white px-2 py-0.5 rounded-full animate-pulse">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </span>
          )}
        </div>
      </header>

      {/* Scoring rule helper banner for first-timers */}
      {initialMatch.division.scoringType === "TRADITIONAL" ? (
        <div className="bg-zinc-950 border-b border-zinc-855 px-4 py-2.5 flex items-center justify-between text-[11px] text-white">
          <span className="font-semibold flex items-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></span>
            Traditional Scoring Active
          </span>
          <span className="text-zinc-400 font-medium">Only serving team scores points</span>
        </div>
      ) : (
        <div className="bg-zinc-955 border-b border-zinc-855 px-4 py-2.5 flex items-center justify-between text-[11px] text-white">
          <span className="font-semibold flex items-center">
            <span className="w-1.5 h-1.5 bg-white rounded-full mr-1.5"></span>
            Rally Scoring Active
          </span>
          <span className="text-zinc-405 font-medium">Every rally won scores a point</span>
        </div>
      )}

      {/* Warning/Error alerts */}
      {error && (
        <div className="bg-black border-b border-dashed border-2 border-white text-white text-xs px-4 py-3 flex items-center">
          <ShieldAlert className="w-4 h-4 mr-2 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Offline Pending Queue Badge */}
      {pendingActionsCount > 0 && (
        <div className="bg-black border-b border-zinc-855 text-white text-xs px-4 py-2 flex justify-between items-center">
          <span>{pendingActionsCount} score updates queued offline</span>
          <button 
            onClick={handleSync}
            disabled={syncing || !isOnline}
            className="bg-zinc-900 hover:bg-white hover:text-black border border-zinc-800 px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      )}

      {/* Core Score Buttons Area */}
      <div className="flex-1 flex flex-col justify-evenly px-4 py-6 space-y-4">
        
        {/* Team A Button */}
        <button
          onClick={() => handleScorePoint(initialMatch.teamAId)}
          disabled={isCompleted || isDisputed}
          className={`flex-1 w-full rounded-3xl p-6 flex flex-col justify-between items-center border transition-all text-center relative ${
            game.servingTeamId === initialMatch.teamAId
              ? "bg-black border-2 border-white shadow-sm"
              : "bg-black border border-zinc-850 opacity-40 hover:opacity-80"
          } active:scale-[0.98] duration-150`}
        >
          {/* Serve indicator dot */}
          {game.servingTeamId === initialMatch.teamAId && (
            <span className="absolute top-4 left-4 bg-white text-black font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping mr-1"></span>
              Serve {game.serverNumber && `• ${game.serverNumber}`}
            </span>
          )}

          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-4">
            {initialMatch.teamA.name}
          </span>
          <span className="text-7xl font-extrabold tracking-tighter text-white font-mono my-4">
            {game.teamAScore}
          </span>
          <span className="text-[10px] text-zinc-400 font-semibold pb-2 uppercase tracking-wide">
            {teamAActionText}
          </span>
        </button>

        {/* Team B Button */}
        <button
          onClick={() => handleScorePoint(initialMatch.teamBId)}
          disabled={isCompleted || isDisputed}
          className={`flex-1 w-full rounded-3xl p-6 flex flex-col justify-between items-center border transition-all text-center relative ${
            game.servingTeamId === initialMatch.teamBId
              ? "bg-black border-2 border-white shadow-sm"
              : "bg-black border border-zinc-850 opacity-40 hover:opacity-80"
          } active:scale-[0.98] duration-150`}
        >
          {/* Serve indicator dot */}
          {game.servingTeamId === initialMatch.teamBId && (
            <span className="absolute top-4 left-4 bg-white text-black font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center space-x-1">
              <span className="w-1.5 h-1.5 bg-black rounded-full animate-ping mr-1"></span>
              Serve {game.serverNumber && `• ${game.serverNumber}`}
            </span>
          )}

          <span className="text-xs text-zinc-500 uppercase tracking-widest font-semibold mt-4">
            {initialMatch.teamB.name}
          </span>
          <span className="text-7xl font-extrabold tracking-tighter text-white font-mono my-4">
            {game.teamBScore}
          </span>
          <span className="text-[10px] text-zinc-400 font-semibold pb-2 uppercase tracking-wide">
            {teamBActionText}
          </span>
        </button>

      </div>

      {/* Inline Help Guide Drawer for First Timers */}
      {showGuide && (
        <div className="bg-zinc-950 border-t border-zinc-855 p-5 space-y-3 text-xs text-zinc-300 animate-in slide-in-from-bottom duration-250">
          <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
            <span className="font-bold text-white uppercase tracking-wider text-[10px]">Volunteer Referee Guide</span>
            <button onClick={() => setShowGuide(false)} className="text-white hover:underline font-semibold">Close</button>
          </div>
          {initialMatch.division.scoringType === "TRADITIONAL" ? (
            <div className="space-y-2">
              <p className="font-semibold text-white">Traditional Scoring Rules:</p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                <li>Only the serving team wins points. Tapping them adds +1 to their score.</li>
                <li>In Doubles, each team gets two serves (Server 1 then Server 2) before it is a Side-out, except for the very first serve of the game (which begins on Server 2).</li>
                <li>Tapping the receiving team will not award points; it automatically manages the server switch or Side-out.</li>
                <li>Use <strong>Undo Point</strong> to revert any scorekeeping mistake.</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="font-semibold text-white">Rally Scoring Rules:</p>
              <ul className="list-disc pl-4 space-y-1 text-zinc-400">
                <li>Every rally won scores a point, regardless of who served!</li>
                <li>Simply tap the button of the team that wins the rally. The system automatically awards the point and calculates everything.</li>
                <li>Use <strong>Undo Point</strong> to revert a mistake.</li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Controls Footer */}
      <div className="border-t border-zinc-855 bg-black p-4 space-y-3">
        {isCompleted ? (
          <div className="bg-white border border-white p-4 rounded-2xl flex items-center justify-center space-x-2 text-black font-extrabold">
            <Check className="w-5 h-5" />
            <span className="font-bold text-sm">Match Completed!</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* Undo Button */}
            <button
              onClick={handleUndo}
              disabled={syncing}
              className="bg-black border border-zinc-800 hover:border-zinc-700 active:scale-[0.98] text-zinc-300 font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Undo Point</span>
            </button>

            {/* Help/Rules Button */}
            <button
              onClick={() => setShowGuide(!showGuide)}
              className={`bg-black border active:scale-[0.98] font-bold py-3.5 px-4 rounded-2xl text-xs flex items-center justify-center space-x-2 transition-all ${
                showGuide ? "border-white text-white bg-zinc-900" : "border-zinc-800 hover:border-zinc-705 text-zinc-300"
              }`}
            >
              <HelpCircle className="w-4 h-4 text-slate-500" />
              <span>{showGuide ? "Close Guide" : "Referee Guide"}</span>
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
