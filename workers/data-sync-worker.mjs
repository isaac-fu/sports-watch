const apiBaseUrl = process.env.DATA_SYNC_API_BASE_URL ?? "http://localhost:3000";
const workerToken = process.env.DATA_SYNC_WORKER_TOKEN ?? "local-sync-token";
const parsedInterval = Number(process.env.DATA_SYNC_INTERVAL_MS ?? "900000");
const intervalMs = Number.isFinite(parsedInterval) && parsedInterval >= 10000 ? parsedInterval : 900000;

async function sync() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/ingestion/sync`, { method: "POST", headers: { "x-worker-token": workerToken } });
    if (!response.ok) throw new Error(`sync endpoint returned ${response.status}`);
    const payload = await response.json();
    console.log(`[data-sync] ${new Date().toISOString()} ${JSON.stringify(payload.data)}`);
    return true;
  } catch (error) {
    console.error(`[data-sync] ${new Date().toISOString()} ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

while (!(await sync())) {
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
setInterval(sync, intervalMs);
