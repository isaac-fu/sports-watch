import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/news/[id]/feedback/route";
import { getAccountContext } from "@/lib/auth-session";
import { loadNewsArticles } from "@/lib/content-repository";
import { recordNewsFeedback } from "@/lib/news-feedback-repository";
vi.mock("@/lib/auth-session", () => ({ getAccountContext: vi.fn() }));
vi.mock("@/lib/content-repository", () => ({ loadNewsArticles: vi.fn() }));
vi.mock("@/lib/news-feedback-repository", () => ({ recordNewsFeedback: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const request = (body: unknown) => new Request("http://localhost/api/news/story/feedback", { method: "POST", body: JSON.stringify(body) });
describe("private news feedback endpoint", () => {
  it("rejects anonymous votes without touching preferences", async () => {
    vi.mocked(getAccountContext).mockResolvedValue({ accountId: "demo", authenticated: false } as never);
    expect((await POST(request({ interest: "interested" }), { params: { id: "story" } })).status).toBe(401);
    expect(recordNewsFeedback).not.toHaveBeenCalled();
  });
  it("only trusts the session account and server article topics", async () => {
    vi.mocked(getAccountContext).mockResolvedValue({ accountId: "account-a", authenticated: true } as never);
    expect((await POST(request({ interest: "interested", accountId: "account-b" }), { params: { id: "story" } })).status).toBe(400);
    const article = { id: "story", title: "NBA betting odds", tags: ["nba"] };
    vi.mocked(loadNewsArticles).mockResolvedValue({ articles: [article] } as never);
    vi.mocked(recordNewsFeedback).mockResolvedValue({} as never);
    const response = await POST(request({ interest: "not-interested" }), { params: { id: "story" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(recordNewsFeedback).toHaveBeenCalledWith("account-a", article, "not-interested");
  });
  it("rejects missing articles without saving", async () => {
    vi.mocked(getAccountContext).mockResolvedValue({ accountId: "account-a", authenticated: true } as never);
    vi.mocked(loadNewsArticles).mockResolvedValue({ articles: [] } as never);
    expect((await POST(request({ interest: "interested" }), { params: { id: "story" } })).status).toBe(404);
    expect(recordNewsFeedback).not.toHaveBeenCalled();
  });
});
