import { loadLatestSyncResults } from "@/lib/content-repository";
import { syncExternalData } from "@/lib/data-sync-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadLatestSyncResults();
  return Response.json({ data, meta: { count: data.length } });
}

export async function POST() {
  const data = await syncExternalData();
  return Response.json({ data, meta: { count: data.length } });
}
