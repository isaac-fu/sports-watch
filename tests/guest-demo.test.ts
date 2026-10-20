import { describe, expect, it } from "vitest";
import { GET as getPreferences, PATCH as patchPreferences } from "@/app/api/preferences/route";
import { POST as saveArticle } from "@/app/api/saved/articles/route";
import { PATCH as markAlertsRead } from "@/app/api/alerts/route";
import { getCurrentPreferences, updateCurrentPreferences } from "@/lib/preferences-repository";
import { demoAccountId } from "@/lib/store";

describe("read-only guest demo", () => {
  it("always returns the seeded guest favorites", async () => {
    const preferences = await getCurrentPreferences(demoAccountId);
    expect(preferences.followedTeamIds).toEqual(["gsw"]);
    expect(preferences.followedPlayerIds).toEqual(["stephen-curry"]);
    await expect(updateCurrentPreferences(demoAccountId, { ...preferences, followedTeamIds: ["bos"] })).rejects.toThrow("read-only");
  });

  it("rejects guest mutations at the API boundary", async () => {
    const preferenceResponse = await patchPreferences(new Request("http://localhost/api/preferences", { method: "PATCH", body: "{}", headers: { "Content-Type": "application/json" } }));
    const savedResponse = await saveArticle(new Request("http://localhost/api/saved/articles", { method: "POST", body: JSON.stringify({ articleId: "story" }), headers: { "Content-Type": "application/json" } }));
    const alertsResponse = await markAlertsRead(new Request("http://localhost/api/alerts", { method: "PATCH", body: JSON.stringify({ all: true }), headers: { "Content-Type": "application/json" } }));
    expect(preferenceResponse.status).toBe(401);
    expect(savedResponse.status).toBe(401);
    expect(alertsResponse.status).toBe(401);
  });

  it("still allows guests to read the seeded preferences", async () => {
    const response = await getPreferences(new Request("http://localhost/api/preferences"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ meta: { authenticated: false } });
  });
});
