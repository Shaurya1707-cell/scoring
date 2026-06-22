"use client";

import { useState, useEffect } from "react";
import { 
  Trophy, 
  ArrowLeft, 
  Tv, 
  Activity, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import Link from "next/link";

interface PublicScorecardClientProps {
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
  };
  isDoubles: boolean;
}

export default function PublicScorecardClient({ initialMatch, isDoubles }: PublicScorecardClientProps) {
  const initialGame = initialMatch.games.find(g => g.status === "IN_PROGRESS") || initialMatch.games[initialMatch.games.length - 1];
  
  const [matchStatus, setMatchStatus] = useState(initialMatch.status);
  const [game, setGame] = useState(initialGame);
  const [gamesList, setGamesList] = useState(initialMatch.games);

  // Connect to SSE for real-time score updates
  useEffect(() => {
    const sseChannel = `match:${initialMatch.id}`;
    const eventSource = new EventSource(`/api/live?channel=${sseChannel}`);

    eventSource.addEventListener("score_update", (e: any) => {
      try {
        const data = JSON.parse(e.data);
        
        // Update the active game scores
        if (data.gameId === game?.id) {
          setGame(prev => ({
            ...prev,
            teamAScore: data.teamAScore,
            teamBScore: data.teamBScore,
            servingTeamId: data.servingTeamId,
            serverNumber: data.serverNumber,
            status: data.gameStatus,
          }));
        }

        // Fetch latest match state to refresh game history list if completed status changes
        if (data.gameStatus === "COMPLETED") {
          fetch(`/api/match/${initialMatch.id}`)
            .then(res => res.json())
            .then(serverMatch => {
              setGamesList(serverMatch.games);
              setMatchStatus(serverMatch.status);
              const activeServerGame = serverMatch.games.find((g: any) => g.status === "IN_PROGRESS") || serverMatch.games[serverMatch.games.length - 1];
              setGame(activeServerGame);
            });
        }

        setMatchStatus(data.matchStatus);
      } catch (err) {
        console.error("SSE parse error in public scorecard:", err);
      }
    });

    eventSource.addEventListener("status_update", (e: any) => {
      try {
        const data = JSON.parse(e.data);
        setMatchStatus(data.status);
        if (data.status === "IN_PROGRESS") {
          fetch(`/api/match/${initialMatch.id}`)
            .then(res => res.json())
            .then(serverMatch => {
              setGamesList(serverMatch.games);
              setMatchStatus(serverMatch.status);
              const activeServerGame = serverMatch.games.find((g: any) => g.status === "IN_PROGRESS") || serverMatch.games[serverMatch.games.length - 1];
              setGame(activeServerGame);
            });
        }
      } catch (err) {
        console.error("SSE status parse error:", err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [initialMatch.id, game?.id]);

  const isCompleted = matchStatus === "COMPLETED";
  const isDisputed = matchStatus === "DISPUTED";

  if (!game) {
    return (
      <div className="flex-1 bg-black text-white min-h-screen flex flex-col justify-between antialiased">
        {/* Navbar */}
        <header className="border-b border-zinc-850 bg-black/85 backdrop-blur-md px-6 py-4 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white underline transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            <span>Leaderboard</span>
          </Link>
          
          <div className="text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
              Scheduled Match
            </span>
            <span className="text-sm font-bold text-zinc-300">
              {initialMatch.division.name}
            </span>
          </div>

          <div className="text-xs text-zinc-500 font-semibold uppercase tracking-wider font-mono">Scheduled</div>
        </header>

        {/* Main Scoreboard Display */}
        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center space-y-8 text-center">
          <div className="bg-zinc-950 border border-zinc-850 rounded-2xl p-12 space-y-4">
            <h2 className="text-lg font-bold text-white">Match Has Not Started</h2>
            <p className="text-zinc-400 text-xs max-w-xs mx-auto">
              This match between <strong className="text-white font-semibold">{initialMatch.teamA.name}</strong> and <strong className="text-white font-semibold">{initialMatch.teamB.name}</strong> is scheduled but has not started yet. Live scores will display once play begins.
            </p>
          </div>
        </main>
        
        {/* Footer */}
        <footer className="border-t border-zinc-855 bg-black p-6 text-center text-xs text-zinc-500">
          Waiting for court scoring assignment.
        </footer>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-black text-white min-h-screen flex flex-col justify-between">
      
      {/* Navbar */}
      <header className="border-b border-zinc-855 bg-black/85 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <Link 
          href="/" 
          className="flex items-center text-xs font-semibold text-zinc-400 hover:text-white underline transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          <span>Leaderboard</span>
        </Link>
        
        <div className="text-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono block">
            Live Scorecard
          </span>
          <span className="text-sm font-bold text-zinc-300">
            {initialMatch.division.name}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-white animate-ping"></div>
          <span className="text-xs font-semibold text-white">Live</span>
        </div>
      </header>

      {/* Main Scoreboard Display */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 flex flex-col justify-center space-y-8">
        
        {/* Round details */}
        <div className="text-center space-y-2">
          <span className="text-xs font-bold font-mono text-white bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-full uppercase tracking-wider">
            {initialMatch.round || "Match Play"}
          </span>
          {isDisputed && (
            <div className="border-2 border-dashed border-white bg-black text-white text-xs px-4 py-2 rounded-xl flex items-center justify-center max-w-sm mx-auto animate-pulse mt-3">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>Score disputed. locked by Admin.</span>
            </div>
          )}
        </div>

        {/* Jumbo Scoreboard Card */}
        <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-8 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-around gap-8 md:gap-4">
          
          {/* Team A Display */}
          <div className="flex flex-col items-center text-center space-y-4 w-full md:w-1/3">
            <span className="text-lg font-bold text-white flex items-center space-x-1">
              {game.servingTeamId === initialMatch.teamAId && (
                <Crown className="w-5 h-5 text-white mr-1 animate-pulse" />
              )}
              {initialMatch.teamA.name}
            </span>
            
            <div className="relative">
              <div className="text-9xl font-black font-mono tracking-tighter text-white bg-black border border-zinc-800 rounded-2xl w-48 h-48 flex items-center justify-center shadow-inner shadow-black">
                {game.teamAScore}
              </div>
              {game.servingTeamId === initialMatch.teamAId && (
                <span className="absolute -top-3 -right-3 bg-white text-black text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shadow-md">
                  Serve {game.serverNumber && `• ${game.serverNumber}`}
                </span>
              )}
            </div>
          </div>

          {/* Versus Divider */}
          <div className="flex flex-col items-center justify-center text-zinc-600 w-full md:w-auto font-light text-2xl">
            <span>VS</span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-2 font-mono">
              Game {game.gameNumber}
            </span>
          </div>

          {/* Team B Display */}
          <div className="flex flex-col items-center text-center space-y-4 w-full md:w-1/3">
            <span className="text-lg font-bold text-white flex items-center space-x-1">
              {game.servingTeamId === initialMatch.teamBId && (
                <Crown className="w-5 h-5 text-white mr-1 animate-pulse" />
              )}
              {initialMatch.teamB.name}
            </span>

            <div className="relative">
              <div className="text-9xl font-black font-mono tracking-tighter text-white bg-black border border-zinc-800 rounded-2xl w-48 h-48 flex items-center justify-center shadow-inner shadow-black">
                {game.teamBScore}
              </div>
              {game.servingTeamId === initialMatch.teamBId && (
                <span className="absolute -top-3 -right-3 bg-white text-black text-[10px] font-bold px-2.5 py-1 rounded-full uppercase shadow-md">
                  Serve {game.serverNumber && `• ${game.serverNumber}`}
                </span>
              )}
            </div>
          </div>

        </div>

        {/* Game History List */}
        <div className="bg-zinc-955 border border-zinc-850 rounded-3xl p-6 space-y-4">
          <div className="border-b border-zinc-850 pb-3">
            <h3 className="font-bold text-zinc-200 text-sm">Game History</h3>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {gamesList.map((g) => {
              const isGCompleted = g.status === "COMPLETED";
              const isWinnerA = g.teamAScore > g.teamBScore;
              const isWinnerB = g.teamBScore > g.teamAScore;

              return (
                <div 
                  key={g.id} 
                  className={`p-4 rounded-2xl border text-center space-y-2 ${
                    isGCompleted ? "bg-black border-zinc-800 text-zinc-400" : "bg-zinc-900 border border-zinc-700 text-white"
                  }`}
                >
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase block">
                    Game {g.gameNumber} {isGCompleted && "✓"}
                  </span>
                  <div className="flex items-center justify-center space-x-3 font-mono font-bold text-base">
                    <span className={isGCompleted && isWinnerA ? "text-white font-bold underline" : "text-zinc-300"}>
                      {g.teamAScore}
                    </span>
                    <span className="text-zinc-600 text-xs font-light">to</span>
                    <span className={isGCompleted && isWinnerB ? "text-white font-bold underline" : "text-zinc-300"}>
                      {g.teamBScore}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      {/* Footer / Winner banner */}
      <footer className="border-t border-zinc-855 bg-black p-6 text-center text-xs text-zinc-500 mt-12">
        {isCompleted ? (
          <div className="flex flex-col items-center space-y-1 text-center">
            <Trophy className="w-8 h-8 text-white animate-bounce mb-1" />
            <p className="text-base font-bold text-white">
              Match Won by {initialMatch.winnerId === initialMatch.teamAId ? initialMatch.teamA.name : initialMatch.teamB.name}!
            </p>
            <p className="text-xs text-zinc-500">Match completed in {gamesList.length} games.</p>
          </div>
        ) : (
          <p>Scoring updates push in real-time. Standings update immediately upon match completion.</p>
        )}
      </footer>

    </div>
  );
}

// Simple Crown icon component for serving team indicator
function Crown({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" />
      <path d="M5 20h14" />
    </svg>
  );
}
