import { digest, redis, token, type EmailSubscriber } from "@/lib/alerts-server";

export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  try {
    const confirmToken = new URL(request.url).searchParams.get("token") ?? "";
    if (!/^[a-f0-9]{48}$/.test(confirmToken)) return Response.redirect(`${origin}/?alerts=invalid`);
    const pendingKey = `fpl:alerts:confirm:${digest(confirmToken)}`;
    const raw = await redis<string | null>("GET", pendingKey);
    if (!raw) return Response.redirect(`${origin}/?alerts=expired`);
    const pending = typeof raw === "string" ? JSON.parse(raw) as { email: string; entryId: number } : raw as { email: string; entryId: number };
    const id = digest(pending.email);
    const unsubscribeToken = token();
    const subscriber: EmailSubscriber = { id, email: pending.email, entryId: pending.entryId, unsubscribeToken };
    await redis("SET", `fpl:alerts:email:${id}`, JSON.stringify(subscriber));
    await redis("SET", `fpl:alerts:unsubscribe:${digest(unsubscribeToken)}`, id);
    await redis("SADD", "fpl:alerts:email:index", id);
    await redis("DEL", pendingKey);
    return Response.redirect(`${origin}/?alerts=confirmed`);
  } catch {
    return Response.redirect(`${origin}/?alerts=error`);
  }
}
