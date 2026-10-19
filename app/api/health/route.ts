export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "sports-watch-api", timestamp: new Date().toISOString() });
}
