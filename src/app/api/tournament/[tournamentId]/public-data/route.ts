import { NextRequest, NextResponse } from "next/server";
import { getPublicTournamentData } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tournamentId: string }> }
) {
  const { tournamentId } = await params;

  try {
    const data = await getPublicTournamentData(tournamentId);

    if (!data) {
      return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("API public data error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
