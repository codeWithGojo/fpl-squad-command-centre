import type { FplEvent, FplPlayer } from "@/lib/fpl-types";
import { errorResponse, fetchFplJson, FplApiError } from "@/lib/fpl-server";

type Bootstrap = { events?: FplEvent[]; elements?: FplPlayer[] };
type Picks = {
  picks?: Array<{
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
  }>;
  entry_history?: {
    bank?: number;
    value?: number;
    points?: number;
    total_points?: number;
    overall_rank?: number;
  };
};
type EntryHistory = { chips?: Array<{ name: string; event: number }> };
type Entry = {
  name?: string;
  player_first_name?: string;
  player_last_name?: string;
  summary_overall_points?: number;
  summary_overall_rank?: number;
};

export async function GET(_request: Request, context: { params: Promise<{ entryId: string }> }) {
  try {
    const { entryId } = await context.params;
    if (!/^\d{1,10}$/.test(entryId)) throw new FplApiError("Enter a valid numeric FPL team ID.", 400);
    const bootstrap = await fetchFplJson<Bootstrap>("/bootstrap-static/", 6 * 60 * 60);
    const events = bootstrap.data.events ?? [];
    const gameweek = events.find((event) => event.is_current)?.id
      ?? events.filter((event) => event.finished || event.is_previous).at(-1)?.id;
    if (!gameweek) throw new FplApiError("No published gameweek squad is available yet.", 404);

    const [picks, entry, history] = await Promise.all([
      fetchFplJson<Picks>(`/entry/${entryId}/event/${gameweek}/picks/`, 30 * 60),
      fetchFplJson<Entry>(`/entry/${entryId}/`, 6 * 60 * 60),
      fetchFplJson<EntryHistory>(`/entry/${entryId}/history/`, 30 * 60),
    ]);
    if (!Array.isArray(picks.data.picks)) throw new FplApiError("This squad is not publicly available for the selected gameweek.", 404);
    const playerIds = picks.data.picks.map((pick) => pick.element);
    const playerTeams = new Map((bootstrap.data.elements ?? []).map((player) => [player.id, player.team]));
    return Response.json({
      entryId: Number(entryId),
      gameweek,
      playerIds,
      teamIds: [...new Set(playerIds.map((id) => playerTeams.get(id)).filter((id): id is number => typeof id === "number"))],
      entryName: entry.data.name,
      playerName: [entry.data.player_first_name, entry.data.player_last_name].filter(Boolean).join(" "),
      picks: picks.data.picks.map((pick) => ({
        element: pick.element,
        position: pick.position,
        multiplier: pick.multiplier,
        isCaptain: pick.is_captain,
        isViceCaptain: pick.is_vice_captain,
      })),
      bank: picks.data.entry_history?.bank ?? 0,
      squadValue: picks.data.entry_history?.value ?? 0,
      lastGameweekPoints: picks.data.entry_history?.points ?? 0,
      overallPoints: entry.data.summary_overall_points ?? picks.data.entry_history?.total_points,
      overallRank: entry.data.summary_overall_rank ?? picks.data.entry_history?.overall_rank,
      usedChips: history.data.chips ?? [],
    }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=21600" } });
  } catch (error) {
    return errorResponse(error);
  }
}
