import { alertConfig } from "@/lib/alerts-server";

export function GET() {
  const config = alertConfig();
  return Response.json({ emailEnabled: config.redis && config.email, pushEnabled: config.redis && config.push, publicKey: config.publicKey }, {
    headers: { "Cache-Control": "public, s-maxage=300" },
  });
}
