const FPL_BASE = "https://fantasy.premierleague.com/api";

type CacheEntry = { data: unknown; expiresAt: number; fetchedAt: number };

const globalCache = globalThis as typeof globalThis & {
  __fplTransferCache?: Map<string, CacheEntry>;
};

const memoryCache = globalCache.__fplTransferCache ?? new Map<string, CacheEntry>();
globalCache.__fplTransferCache = memoryCache;

export class FplApiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "FplApiError";
    this.status = status;
  }
}

function isJsonShape(value: unknown) {
  return value !== null && (Array.isArray(value) || typeof value === "object");
}

export async function fetchFplJson<T>(path: string, ttlSeconds: number): Promise<{ data: T; fetchedAt: number; stale: boolean }> {
  const now = Date.now();
  const cached = memoryCache.get(path);
  if (cached && cached.expiresAt > now) {
    return { data: cached.data as T, fetchedAt: cached.fetchedAt, stale: false };
  }

  try {
    const response = await fetch(`${FPL_BASE}${path}`, {
      headers: { Accept: "application/json", "User-Agent": "FPL-Transfer-Assistant/1.0" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new FplApiError(response.status === 404 ? "That FPL record was not found." : "The official FPL service is temporarily unavailable.", response.status === 404 ? 404 : 502);
    }
    const data = await response.json() as T;
    if (!isJsonShape(data)) throw new FplApiError("FPL returned an unexpected response format.");
    memoryCache.set(path, { data, fetchedAt: now, expiresAt: now + ttlSeconds * 1000 });
    return { data, fetchedAt: now, stale: false };
  } catch (error) {
    if (cached) return { data: cached.data as T, fetchedAt: cached.fetchedAt, stale: true };
    if (error instanceof FplApiError) throw error;
    throw new FplApiError("Could not reach the official FPL service. Please try again shortly.");
  }
}

export function secondsUntilNextDeadline(events: Array<{ deadline_time?: string; finished?: boolean }>) {
  const now = Date.now();
  const deadline = events
    .map((event) => Date.parse(event.deadline_time ?? ""))
    .filter((value) => Number.isFinite(value) && value > now)
    .sort((a, b) => a - b)[0];
  if (!deadline) return 6 * 60 * 60;
  return Math.max(30 * 60, Math.min(7 * 24 * 60 * 60, Math.floor((deadline - now) / 1000)));
}

export function errorResponse(error: unknown) {
  const status = error instanceof FplApiError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Something went wrong while loading FPL data.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
