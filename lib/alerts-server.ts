import { createHash, randomBytes } from "node:crypto";

export type AlertSnapshot = Record<string, { status: string; news: string; cost: number }>;
export type EmailSubscriber = {
  id: string;
  email: string;
  entryId: number;
  unsubscribeToken: string;
  snapshot?: AlertSnapshot;
};
export type PushSubscriber = {
  id: string;
  entryId: number;
  subscription: PushSubscriptionJSON;
  snapshot?: AlertSnapshot;
};

export function alertConfig() {
  return {
    redis: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    email: Boolean(process.env.RESEND_API_KEY && process.env.ALERT_FROM_EMAIL),
    push: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT),
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
  };
}

export function token() { return randomBytes(24).toString("hex"); }
export function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }

export async function redis<T = unknown>(...command: Array<string | number>) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const auth = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !auth) throw new Error("Alert storage is not configured.");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Alert storage did not respond.");
  const payload = await response.json() as { result?: T; error?: string };
  if (payload.error) throw new Error(payload.error);
  return payload.result as T;
}

export async function sendAlertEmail(to: string, subject: string, html: string, idempotencyKey: string) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL) throw new Error("Email delivery is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ from: process.env.ALERT_FROM_EMAIL, to: [to], subject, html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Email delivery failed.");
}
