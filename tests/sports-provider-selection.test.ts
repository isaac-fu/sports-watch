import { afterEach, describe, expect, it } from "vitest";
import { getNbaProvider } from "@/lib/providers";

const originalProvider = process.env.SPORTS_DATA_PROVIDER;
const originalApiKey = process.env.BALLDONTLIE_API_KEY;

afterEach(() => {
  if (originalProvider === undefined) delete process.env.SPORTS_DATA_PROVIDER;
  else process.env.SPORTS_DATA_PROVIDER = originalProvider;
  if (originalApiKey === undefined) delete process.env.BALLDONTLIE_API_KEY;
  else process.env.BALLDONTLIE_API_KEY = originalApiKey;
});

describe("sports provider selection", () => {
  it("uses mock data only when mock is explicitly configured", () => {
    process.env.SPORTS_DATA_PROVIDER = "mock";
    expect(getNbaProvider().name).toBe("mock-repository");
  });

  it("does not silently switch to mock when a real provider is incomplete", async () => {
    process.env.SPORTS_DATA_PROVIDER = "balldontlie";
    delete process.env.BALLDONTLIE_API_KEY;
    const provider = getNbaProvider();
    expect(provider.name).toBe("balldontlie-unavailable");
    await expect(provider.getGames()).rejects.toThrow("not configured");
  });
});
