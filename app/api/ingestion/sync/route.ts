import { loadLatestSyncResults } from "@/lib/content-repository";
import { syncExternalData } from "@/lib/data-sync-service";
import { isValidWorkerToken } from "@/lib/worker-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await loadLatestSyncResults();
  return Response.json({ data, meta: { count: data.length } });
}

export async function POST(request: Request) {
  if (!isValidWorkerToken(request, process.env.DATA_SYNC_WORKER_TOKEN, "local-sync-token")) {
    return Response.json({ error: "Unauthorized worker request." }, { status: 401 });
  }
  const data = await syncExternalData();
  return Response.json({ data, meta: { count: data.length } });
}
