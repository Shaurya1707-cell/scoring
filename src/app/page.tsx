import prisma from "@/lib/db";
import { getPublicTournamentData } from "@/lib/queries";
import PublicDashboardClient from "./PublicDashboardClient";
import { Trophy, RefreshCw } from "lucide-react";
import { reseedFormAction } from "@/app/actions/adminActions";

export const dynamic = "force-dynamic";

export default async function PublicPage() {
  // Fetch first tournament
  const tournament = await prisma.tournament.findFirst({
    orderBy: { startDate: "asc" },
  });

  if (!tournament) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <Trophy className="w-16 h-16 text-white mx-auto animate-pulse" />
          <h1 className="text-2xl font-bold">Welcome to Antigravity Scoring</h1>
          <p className="text-zinc-400">
            No live tournament is configured in the database yet. Click below to populate the database with mock test data.
          </p>
          <form action={reseedFormAction}>
            <button className="bg-white hover:bg-zinc-200 text-black rounded-xl py-3 px-6 font-semibold flex items-center space-x-2 mx-auto transition-all shadow-md">
              <RefreshCw className="w-5 h-5" />
              <span>Initialize Mock Tournament</span>
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Get compiled public data
  const data = await getPublicTournamentData(tournament.id);

  if (!data) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-black text-white min-h-screen">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Error loading tournament data</h1>
          <p className="text-zinc-400">Unable to load the current tournament standings.</p>
        </div>
      </main>
    );
  }

  // Serialize date objects to strings to prevent SSR serialization errors
  const serializedData = {
    tournament: {
      ...data.tournament,
      startDate: data.tournament.startDate.toISOString(),
      endDate: data.tournament.endDate.toISOString(),
      createdAt: data.tournament.createdAt.toISOString(),
      updatedAt: data.tournament.updatedAt.toISOString(),
    },
    standings: data.standings,
    matches: data.matches.map((m) => ({
      ...m,
      scheduledTime: m.scheduledTime ? m.scheduledTime.toISOString() : null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      games: m.games.map((g) => ({
        ...g,
        createdAt: g.createdAt.toISOString(),
        updatedAt: g.updatedAt.toISOString(),
      })),
    })),
  };

  return <PublicDashboardClient initialData={serializedData as any} />;
}
