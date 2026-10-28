import { afterEach, describe, expect, it, vi } from "vitest";
import { articleContentAllowedDomains, enrichNewsArticles, extractArticleText } from "@/lib/article-enrichment";
import { publicNewsArticle } from "@/lib/news-text";
import type { NewsArticle } from "@/lib/models";

const originalDomains = process.env.ARTICLE_CONTENT_ALLOWED_DOMAINS;
const restore = (value: string | undefined) => value === undefined ? delete process.env.ARTICLE_CONTENT_ALLOWED_DOMAINS : void (process.env.ARTICLE_CONTENT_ALLOWED_DOMAINS = value);

afterEach(() => {
  restore(originalDomains);
  vi.unstubAllGlobals();
});

const article = (url: string): NewsArticle => ({
  id: "story-1",
  title: "A detailed NBA story",
  summary: "Short summary.",
  source: "NBA Test Wire",
  publishedAt: "2026-10-19T10:00:00.000Z",
  url,
  teamIds: ["okc"],
  playerIds: [],
  tags: ["nba"],
});

describe("article enrichment", () => {
  it("extracts the main story while dropping navigation and advertisements", () => {
    const html = `<html><body><nav>Scores Teams Tickets</nav><main><article><h1>Thunder adjust late</h1><p>${"Oklahoma City used a smaller lineup and aggressive switching to control the final quarter. ".repeat(8)}</p></article></main><aside class="advertisement">Buy something</aside></body></html>`;
    const text = extractArticleText(html, "https://nba.com/news/test");
    expect(text).toContain("aggressive switching");
    expect(text).not.toContain("Scores Teams Tickets");
    expect(text).not.toContain("Buy something");
  });

  it("fetches only approved publisher domains and records extracted text", async () => {
    process.env.ARTICLE_CONTENT_ALLOWED_DOMAINS = "nba.com";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<html><body><article><h1>Game analysis</h1><p>${"The team created better shots through pace, spacing, and strong-side actions. ".repeat(10)}</p></article></body></html>`, { headers: { "Content-Type": "text/html" } })));
    const [enriched, blocked] = await enrichNewsArticles([article("https://www.nba.com/news/test"), { ...article("https://example.com/story"), id: "blocked" }]);
    expect(articleContentAllowedDomains()).toEqual(["nba.com"]);
    expect(enriched).toMatchObject({ articleTextStatus: "fetched", articleTextHash: expect.any(String) });
    expect(enriched.articleText).toContain("pace, spacing");
    expect(blocked.articleTextStatus).toBe("blocked");
  });

  it("never exposes stored article text through public article objects", () => {
    const publicArticle = publicNewsArticle({ ...article("https://nba.com/news/test"), articleText: "Private extracted article body", articleTextStatus: "fetched", articleTextHash: "hash" });
    expect(publicArticle).not.toHaveProperty("articleText");
    expect(publicArticle).not.toHaveProperty("articleTextStatus");
    expect(publicArticle).not.toHaveProperty("articleTextHash");
  });
});
