import { alertConfig, digest, redis, sendAlertEmail, token } from "@/lib/alerts-server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const config = alertConfig();
    if (!config.redis || !config.email) return Response.json({ error: "Email alerts are awaiting service setup." }, { status: 503 });
    const body = await request.json() as { email?: string; entryId?: string | number };
    const email = String(body.email ?? "").trim().toLowerCase();
    const entryId = String(body.entryId ?? "");
    if (!EMAIL.test(email) || !/^\d{1,10}$/.test(entryId)) return Response.json({ error: "Enter a valid email and FPL team ID." }, { status: 400 });

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const rateKey = `fpl:alerts:rate:${digest(forwarded).slice(0, 24)}`;
    const count = await redis<number>("INCR", rateKey);
    if (count === 1) await redis("EXPIRE", rateKey, 3600);
    if (count > 5) return Response.json({ error: "Too many alert requests. Try again later." }, { status: 429 });

    const confirmToken = token();
    const pendingKey = `fpl:alerts:confirm:${digest(confirmToken)}`;
    await redis("SET", pendingKey, JSON.stringify({ email, entryId: Number(entryId) }), "EX", 86400);
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const confirmUrl = `${origin}/api/fpl/alerts/confirm?token=${confirmToken}`;
    await sendAlertEmail(email, "Confirm your FPL squad alerts", `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h1>Confirm FPL alerts</h1><p>You requested injury and price-change alerts for team ${entryId}.</p><p><a href="${confirmUrl}" style="display:inline-block;background:#37003c;color:white;padding:12px 18px;border-radius:10px;text-decoration:none">Confirm alerts</a></p><p>If this was not you, ignore this email.</p></div>`, `fpl-confirm-${digest(confirmToken).slice(0, 32)}`);
    return Response.json({ ok: true, message: "Check your email to confirm alerts." });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not create the alert." }, { status: 500 });
  }
}
