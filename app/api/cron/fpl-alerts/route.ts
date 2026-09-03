import type { FplEvent, FplPlayer } from "@/lib/fpl-types";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { redis, sendAlertEmail, type AlertSnapshot, type EmailSubscriber, type PushSubscriber } from "@/lib/alerts-server";
import { fetchFplJson } from "@/lib/fpl-server";

type Bootstrap = { events?: FplEvent[]; elements?: FplPlayer[] };
type Picks = { picks?: Array<{ element: number }> };

function parseRecord<T>(value: T | string | null) {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) as T : value;
}

function snapshotFor(ids: number[], players: Map<number, FplPlayer>): AlertSnapshot {
  return Object.fromEntries(ids.flatMap((id) => {
    const player = players.get(id);
    return player ? [[String(id), { status: player.status, news: player.news, cost: player.now_cost }]] : [];
  }));
}

function changes(previous: AlertSnapshot | undefined, next: AlertSnapshot, players: Map<number, FplPlayer>) {
  if (!previous) return [];
  return Object.entries(next).flatMap(([id, value]) => {
    const before = previous[id];
    const player = players.get(Number(id));
    if (!before || !player) return [];
    const messages: string[] = [];
    if (before.cost !== value.cost) messages.push(`${player.web_name} changed from £${(before.cost / 10).toFixed(1)}m to £${(value.cost / 10).toFixed(1)}m.`);
    if (before.status !== value.status || (value.news && before.news !== value.news)) messages.push(`${player.web_name}: ${value.news || "availability status changed"}.`);
    return messages;
  });
}

async function squadIds(entryId: number, gameweek: number) {
  const picks = await fetchFplJson<Picks>(`/entry/${entryId}/event/${gameweek}/picks/`, 15 * 60);
  return (picks.data.picks ?? []).map((pick) => pick.element);
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const bootstrap = await fetchFplJson<Bootstrap>("/bootstrap-static/", 30 * 60);
    const players = new Map((bootstrap.data.elements ?? []).map((player) => [player.id, player]));
    const events = bootstrap.data.events ?? [];
    const gameweek = events.find((event) => event.is_current)?.id ?? events.filter((event) => event.finished).at(-1)?.id;
    if (!gameweek) return Response.json({ ok: true, checked: 0, sent: 0 });
    const emailIds = (await redis<string[]>("SMEMBERS", "fpl:alerts:email:index") ?? []).slice(0, 250);
    const pushIds = (await redis<string[]>("SMEMBERS", "fpl:alerts:push:index") ?? []).slice(0, 250);
    let sent = 0;
    let checked = 0;
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    for (const id of emailIds) {
      const subscriber = parseRecord<EmailSubscriber>(await redis<EmailSubscriber | string | null>("GET", `fpl:alerts:email:${id}`));
      if (!subscriber) continue;
      try {
        const ids = await squadIds(subscriber.entryId, gameweek);
        const next = snapshotFor(ids, players);
        const notices = changes(subscriber.snapshot, next, players);
        if (notices.length) {
          const unsubscribe = `${origin}/api/fpl/alerts/unsubscribe?token=${subscriber.unsubscribeToken}`;
          await sendAlertEmail(subscriber.email, `${notices.length} FPL squad update${notices.length === 1 ? "" : "s"}`, `<div style="font-family:Arial,sans-serif;max-width:580px;margin:auto"><h1>Your FPL squad changed</h1>${notices.map((notice) => `<p>${notice}</p>`).join("")}<p><a href="${origin}">Open your squad command centre</a></p><p style="font-size:12px;color:#777"><a href="${unsubscribe}">Unsubscribe</a></p></div>`, `fpl-alert-${id}-${gameweek}-${Date.now().toString().slice(0, -5)}`);
          sent += 1;
        }
        await redis("SET", `fpl:alerts:email:${id}`, JSON.stringify({ ...subscriber, snapshot: next }));
        checked += 1;
      } catch { /* One invalid/private entry must not stop the daily run. */ }
    }

    if (process.env.VAPID_SUBJECT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      const webpush = (await import("web-push")).default;
      webpush.setVapidDetails(process.env.VAPID_SUBJECT, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
      for (const id of pushIds) {
        const subscriber = parseRecord<PushSubscriber>(await redis<PushSubscriber | string | null>("GET", `fpl:alerts:push:${id}`));
        if (!subscriber) continue;
        try {
          const ids = await squadIds(subscriber.entryId, gameweek);
          const next = snapshotFor(ids, players);
          const notices = changes(subscriber.snapshot, next, players);
          if (notices.length) {
            await webpush.sendNotification(subscriber.subscription as WebPushSubscription, JSON.stringify({ title: "FPL squad alert", body: notices.slice(0, 2).join(" "), url: origin, tag: `fpl-${gameweek}` }));
            sent += 1;
          }
          await redis("SET", `fpl:alerts:push:${id}`, JSON.stringify({ ...subscriber, snapshot: next }));
          checked += 1;
        } catch { /* Expired subscriptions can be disabled by the visitor. */ }
      }
    }
    return Response.json({ ok: true, checked, sent });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Alert run failed." }, { status: 500 });
  }
}
