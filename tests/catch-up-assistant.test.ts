import { afterEach, describe, expect, it, vi } from "vitest";
import { answerCatchUpQuestion, catchUpSearchDomains, shouldSearchCatchUpWeb } from "@/lib/catch-up-assistant";

const original = {
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL,
  mode: process.env.CATCH_UP_WEB_SEARCH,
  domains: process.env.CATCH_UP_SEARCH_DOMAINS,
};
const restore = (name: string, value: string | undefined) => value === undefined ? delete process.env[name] : void (process.env[name] = value);

afterEach(() => {
  restore("GROQ_API_KEY", original.apiKey);
  restore("GROQ_MODEL", original.model);
  restore("CATCH_UP_WEB_SEARCH", original.mode);
  restore("CATCH_UP_SEARCH_DOMAINS", original.domains);
  vi.unstubAllGlobals();
});

const moment = { id: "moment-1", title: "Late run decides it", detail: "Oklahoma City closed on a 12-2 run.", reason: "Key late-game swing", importanceScore: 91, source: "game-event" as const, context: "Q4 · 1:22" };

describe("catch-up assistant", () => {
  it("provides a useful local answer when Groq is not configured", async () => {
    delete process.env.GROQ_API_KEY;
    const result = await answerCatchUpQuestion(moment, "Summarize this in one sentence");
    expect(result).toMatchObject({ provider: "local", webSearchUsed: false, citations: [], fallbackReason: "not-configured" });
    expect(result.answer).toContain("12-2 run");
  });

  it("searches selectively for freshness questions but not recap questions", () => {
    process.env.CATCH_UP_WEB_SEARCH = "selective";
    expect(shouldSearchCatchUpWeb("What is the latest update?")).toBe(true);
    expect(shouldSearchCatchUpWeb("Summarize this in one sentence")).toBe(false);
    process.env.CATCH_UP_WEB_SEARCH = "false";
    expect(shouldSearchCatchUpWeb("Find the latest update")).toBe(false);
  });

  it("keeps ordinary questions context-only even when selective search is enabled", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.CATCH_UP_WEB_SEARCH = "selective";
    const requestBodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ output: [{ type: "message", content: [{ type: "output_text", text: "It mattered because the run decided the game.", annotations: [] }] }] });
    }));
    const result = await answerCatchUpQuestion(moment, "Why does this matter?");
    expect(requestBodies[0]).not.toHaveProperty("tools");
    expect(result).toMatchObject({ provider: "groq", webSearchUsed: false, citations: [] });
  });

  it("limits freshness searches to trusted domains and returns clickable citation metadata", async () => {
    process.env.GROQ_API_KEY = "test-key";
    process.env.CATCH_UP_WEB_SEARCH = "selective";
    process.env.CATCH_UP_SEARCH_DOMAINS = "nba.com, https://espn.com/nba,not a domain";
    const requestBodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ output: [
        { type: "browser_search_call", status: "completed" },
        { type: "message", content: [{ type: "output_text", text: "The player remains questionable.", annotations: [{ type: "url_citation", start_index: 0, end_index: 31, url: "https://www.nba.com/news/update", title: "NBA injury update" }] }] },
      ] });
    }));
    const result = await answerCatchUpQuestion(moment, "What is the latest status?");
    expect(catchUpSearchDomains()).toEqual(["nba.com", "espn.com"]);
    expect(requestBodies[0]).toMatchObject({
      tool_choice: "required",
      tools: [{ type: "browser_search" }],
    });
    expect(result).toMatchObject({ provider: "groq", webSearchUsed: true });
    expect(result.citations).toEqual([{ url: "https://www.nba.com/news/update", title: "NBA injury update", startIndex: 0, endIndex: 31 }]);
  });

  it("falls back to the saved recap when Groq is unavailable", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("rate limited", { status: 429 })));
    const result = await answerCatchUpQuestion(moment, "Why does this matter?");
    expect(result).toMatchObject({ provider: "local", webSearchUsed: false, fallbackReason: "provider-unavailable" });
    expect(result.answer).toContain("12-2 run");
  });
});
