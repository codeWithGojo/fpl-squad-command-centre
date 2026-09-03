import type { FplEvent, LivePlayer } from "@/lib/fpl-types";
import { errorResponse, fetchFplJson, FplApiError } from "@/lib/fpl-server";

type Bootstrap = { events?: FplEvent[] };
type LiveResponse = { elements?: LivePlayer[] };

export async function GET(_request: Request, context: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await context.params;
    if (!/^\d{1,2}$/.test(eventId) || Number(eventId) < 1 || Number(eventId) > 38) {
      throw new FplApiError("Enter a valid gameweek from 1 to 38.", 400);
    }
    const [live, bootstrap] = await Promise.all([
      fetchFplJson<LiveResponse>(`/event/${eventId}/live/`, 15 * 60),
      fetchFplJson<Bootstrap>("/bootstrap-static/", 6 * 60 * 60),
    ]);
    if (!Array.isArray(live.data.elements)) throw new FplApiError("Live gameweek data is not available yet.", 404);
    const ttl = 15 * 60;
    const fetchedAt = Math.min(live.fetchedAt, bootstrap.fetchedAt);
    return Response.json({
      event: Number(eventId),
      players: live.data.elements,
      meta: {
        source: "Official Fantasy Premier League API",
        fetchedAt: new Date(fetchedAt).toISOString(),
        nextRefreshAt: new Date(Date.now() + ttl * 1000).toISOString(),
        stale: live.stale || bootstrap.stale,
      },
    }, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
  } catch (error) {
    return errorResponse(error);
  }
}
