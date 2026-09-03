import type { FplEvent, FplFixture, FplPlayer, FplTeam } from "@/lib/fpl-types";
import { errorResponse, fetchFplJson, secondsUntilNextDeadline } from "@/lib/fpl-server";

type Bootstrap = {
  teams?: FplTeam[];
  elements?: FplPlayer[];
  events?: FplEvent[];
  element_types?: Array<{ id: number; singular_name_short: string }>;
  total_players?: number;
};

export async function GET() {
  try {
    const bootstrapResult = await fetchFplJson<Bootstrap>("/bootstrap-static/", 6 * 60 * 60);
    const { teams, elements, events, element_types } = bootstrapResult.data;
    if (!Array.isArray(teams) || !Array.isArray(elements) || !Array.isArray(events)) {
      throw new Error("The FPL player data format has changed. Please try again later.");
    }
    const ttl = secondsUntilNextDeadline(events);
    const fixtureResult = await fetchFplJson<FplFixture[]>("/fixtures/", ttl);
    if (!Array.isArray(fixtureResult.data)) throw new Error("The FPL fixture data format has changed.");

    const fetchedAt = Math.min(bootstrapResult.fetchedAt, fixtureResult.fetchedAt);
    return Response.json({
      teams,
      players: elements,
      events,
      fixtures: fixtureResult.data,
      positions: Object.fromEntries((element_types ?? []).map((type) => [type.id, type.singular_name_short])),
      totalPlayers: Number(bootstrapResult.data.total_players) || 0,
      meta: {
        source: "Official Fantasy Premier League API",
        fetchedAt: new Date(fetchedAt).toISOString(),
        nextRefreshAt: new Date(Date.now() + ttl * 1000).toISOString(),
        stale: bootstrapResult.stale || fixtureResult.stale,
      },
    }, {
      headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=86400` },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
