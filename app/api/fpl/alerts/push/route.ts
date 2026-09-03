import { alertConfig, digest, redis, type PushSubscriber } from "@/lib/alerts-server";

export async function POST(request: Request) {
  try {
    const config = alertConfig();
    if (!config.redis || !config.push) return Response.json({ error: "Background push alerts are awaiting service setup." }, { status: 503 });
    const body = await request.json() as { entryId?: string | number; subscription?: PushSubscriptionJSON };
    const entryId = String(body.entryId ?? "");
    const endpoint = body.subscription?.endpoint;
    if (!/^\d{1,10}$/.test(entryId) || !endpoint?.startsWith("https://")) return Response.json({ error: "Invalid push subscription." }, { status: 400 });
    const id = digest(endpoint);
    const subscriber: PushSubscriber = { id, entryId: Number(entryId), subscription: body.subscription! };
    await redis("SET", `fpl:alerts:push:${id}`, JSON.stringify(subscriber));
    await redis("SADD", "fpl:alerts:push:index", id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not enable push alerts." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as { endpoint?: string };
    if (!body.endpoint) return Response.json({ ok: true });
    const id = digest(body.endpoint);
    await redis("DEL", `fpl:alerts:push:${id}`);
    await redis("SREM", "fpl:alerts:push:index", id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not disable push alerts." }, { status: 500 });
  }
}
