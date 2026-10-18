const baseUrl = process.env.ALERT_API_BASE_URL ?? "http://localhost:3000";
const intervalMs = Math.max(5_000, Number(process.env.ALERT_POLL_INTERVAL_MS ?? "30000"));
const workerToken = process.env.ALERT_WORKER_TOKEN;

async function processAlerts() {
  try {
    const response = await fetch(`${baseUrl}/api/alerts/process`, {
      method: "POST",
      headers: workerToken ? { "x-worker-token": workerToken } : undefined,
    });
    if (!response.ok) throw new Error(`Alert API returned ${response.status}`);
    const payload = await response.json();
    const delivered = payload?.data?.deliveredCount ?? 0;
    if (delivered > 0) process.stdout.write(`[alert-worker] delivered ${delivered} alert(s)\n`);
  } catch (error) {
    process.stderr.write(`[alert-worker] ${error instanceof Error ? error.message : "processing failed"}\n`);
  }
}

await processAlerts();
setInterval(processAlerts, intervalMs);
