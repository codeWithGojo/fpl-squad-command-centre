import { digest, redis } from "@/lib/alerts-server";

export async function GET(request: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  try {
    const value = new URL(request.url).searchParams.get("token") ?? "";
    const tokenKey = `fpl:alerts:unsubscribe:${digest(value)}`;
    const id = await redis<string | null>("GET", tokenKey);
    if (id) {
      await redis("DEL", `fpl:alerts:email:${id}`);
      await redis("SREM", "fpl:alerts:email:index", id);
      await redis("DEL", tokenKey);
    }
    return Response.redirect(`${origin}/?alerts=unsubscribed`);
  } catch {
    return Response.redirect(`${origin}/?alerts=error`);
  }
}
