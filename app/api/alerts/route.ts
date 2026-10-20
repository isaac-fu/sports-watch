import { getAccountAlerts, processAccountAlerts, readAccountAlerts } from "@/lib/alerts-service";
import { getAccountContext } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAccountContext(request);
  const data = await getAccountAlerts(context.accountId);
  return Response.json({ data, meta: { count: data.length, unreadCount: data.filter((alert) => !alert.read).length } });
}

export async function POST(request: Request) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to process personal alerts." }, { status: 401 });
  const { candidates, delivered } = await processAccountAlerts(context.accountId);
  return Response.json({ data: delivered, meta: { candidateCount: candidates.length, deliveredCount: delivered.length, deduplicatedCount: candidates.length - delivered.length } });
}

export async function PATCH(request: Request) {
  const context = await getAccountContext(request);
  if (!context.authenticated) return Response.json({ error: "Sign in to manage alerts." }, { status: 401 });
  const body = await request.json() as { id?: unknown; all?: unknown };
  if (body.id !== undefined && typeof body.id !== "string") return Response.json({ error: "id must be a string." }, { status: 400 });
  if (!body.id && body.all !== true) return Response.json({ error: "Provide an alert id or set all to true." }, { status: 400 });
  const data = await readAccountAlerts(context.accountId, body.id as string | undefined);
  return Response.json({ data, meta: { updatedCount: data.length } });
}
