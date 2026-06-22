import prisma from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import MatchesManageClient from "./MatchesManageClient";
import Link from "next/link";
import { Trophy, ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminMatchesPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  // Fetch all matches for the tournament, including games, teams, division, court
  const matches = await prisma.match.findMany({
    include: {
      division: true,
      court: true,
      teamA: true,
      teamB: true,
      games: {
        orderBy: { gameNumber: "asc" },
      },
    },
    orderBy: [
      { status: "asc" }, // Live matches first
      { scheduledTime: "asc" },
    ],
  });

  // Fetch audit logs for overrides
  const auditLogs = await prisma.auditLog.findMany({
    include: {
      performedBy: {
        select: { name: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Format matches date times to satisfy Next.js SSR string serialization
  const serializedMatches = matches.map((m) => ({
    ...m,
    scheduledTime: m.scheduledTime ? new Date(m.scheduledTime) : null,
    createdAt: new Date(m.createdAt),
    updatedAt: new Date(m.updatedAt),
    games: m.games.map((g) => ({
      ...g,
      createdAt: new Date(g.createdAt),
      updatedAt: new Date(g.updatedAt),
    })),
  }));

  const serializedLogs = auditLogs.map((l) => ({
    ...l,
    createdAt: new Date(l.createdAt),
  }));

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin"
            className="p-2 bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Override Scoreboard</h1>
              <span className="text-xs text-rose-400 font-medium">Override & Resolve Disputes</span>
            </div>
          </div>
        </div>

        <div className="text-right hidden sm:block">
          <p className="text-xs text-slate-500 uppercase font-mono tracking-wider">Logged In As</p>
          <p className="text-sm font-semibold text-slate-200">{session.name}</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8">
        <MatchesManageClient 
          matches={serializedMatches as any} 
          auditLogs={serializedLogs as any} 
          adminId={session.id} 
        />
      </main>
    </div>
  );
}
