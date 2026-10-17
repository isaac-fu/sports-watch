export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok", service: "courtside-api", timestamp: new Date().toISOString() });
}
