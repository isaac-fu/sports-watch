import { describe, expect, it } from "vitest";
import { isValidWorkerToken } from "@/lib/worker-auth";

describe("worker authentication", () => {
  it("accepts the configured token and rejects incorrect tokens", () => {
    const valid = new Request("http://localhost/api/ingestion/sync", { headers: { "x-worker-token": "secret-token" } });
    const invalid = new Request("http://localhost/api/ingestion/sync", { headers: { "x-worker-token": "wrong-token" } });
    expect(isValidWorkerToken(valid, "secret-token", "local-sync-token")).toBe(true);
    expect(isValidWorkerToken(invalid, "secret-token", "local-sync-token")).toBe(false);
  });

  it("uses the local fallback outside production", () => {
    const request = new Request("http://localhost/api/ingestion/sync", { headers: { "x-worker-token": "local-sync-token" } });
    expect(isValidWorkerToken(request, undefined, "local-sync-token")).toBe(true);
  });
});
