import type { MiniLeagueStanding } from "@/lib/fpl-types";
import { errorResponse, fetchFplJson, FplApiError } from "@/lib/fpl-server";

type StandingsResponse = {
  league?: { id?: number; name?: string; created?: string };
  standings?: {
    has_next?: boolean;
    page?: number;
    results?: Array<{
      id: number;
      entry: number;
      entry_name: string;
      player_name: string;
      rank: number;
      last_rank: number;
      total: number;
    }>;
  };
};

export async function GET(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  try {
    const { leagueId } = await context.params;
    if (!/^\d{1,10}$/.test(leagueId)) throw new FplApiError("Enter a valid numeric mini-league ID.", 400);
    const requestedPage = Number(new URL(request.url).searchParams.get("page") || 1);
    const page = Number.isInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 20 ? requestedPage : 1;
    const response = await fetchFplJson<StandingsResponse>(`/leagues-classic/${leagueId}/standings/?page_standings=${page}`, 15 * 60);
    const results = response.data.standings?.results;
    if (!response.data.league?.name || !Array.isArray(results)) throw new FplApiError("That public mini-league was not found.", 404);
    const standings: MiniLeagueStanding[] = results.map((row) => ({
      id: row.id,
      entry: row.entry,
      entryName: row.entry_name,
      playerName: row.player_name,
      rank: row.rank,
      lastRank: row.last_rank,
      total: row.total,
    }));
    return Response.json({
      league: { id: response.data.league.id ?? Number(leagueId), name: response.data.league.name, created: response.data.league.created },
      standings,
      hasNext: Boolean(response.data.standings?.has_next),
      page,
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    return errorResponse(error);
  }
}
