import type { FplEvent, FplHistoryRow } from "@/lib/fpl-types";
import { errorResponse, fetchFplJson, FplApiError, secondsUntilNextDeadline } from "@/lib/fpl-server";

type Summary = { history?: FplHistoryRow[] };
type Bootstrap = { events?: FplEvent[] };

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) throw new FplApiError("Choose a valid player.", 400);
    const bootstrap = await fetchFplJson<Bootstrap>("/bootstrap-static/", 6 * 60 * 60);
    const ttl = secondsUntilNextDeadline(bootstrap.data.events ?? []);
    const result = await fetchFplJson<Summary>(`/element-summary/${id}/`, ttl);
    if (!Array.isArray(result.data.history)) throw new Error("The FPL player history format has changed.");
    return Response.json({
      history: result.data.history,
      meta: {
        source: "Official Fantasy Premier League API",
        fetchedAt: new Date(result.fetchedAt).toISOString(),
        nextRefreshAt: new Date(Date.now() + ttl * 1000).toISOString(),
        stale: result.stale,
      },
    }, { headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=86400` } });
  } catch (error) {
    return errorResponse(error);
  }
}
