import { processAllAccountAlerts } from "@/lib/alerts-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requiredToken = process.env.ALERT_WORKER_TOKEN;
  if (requiredToken && request.headers.get("x-worker-token") !== requiredToken) {
    return Response.json({ error: "Unauthorized worker request." }, { status: 401 });
  }
  const data = await processAllAccountAlerts();
  return Response.json({ data, meta: data });
}
