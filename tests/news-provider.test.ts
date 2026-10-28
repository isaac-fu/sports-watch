import { afterEach, describe, expect, it, vi } from "vitest";
import type { NewsArticle } from "@/lib/models";
import { CompositeNewsProvider } from "@/lib/providers/composite-news-provider";
import type { NewsProvider } from "@/lib/providers/news-provider";
import { RssNewsProvider } from "@/lib/providers/rss-news-provider";

afterEach(() => vi.unstubAllGlobals());

describe("RSS and Atom news", () => {
  it("combines valid feeds, classifies entities, and tolerates one failed source", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("failed")) return new Response("unavailable", { status: 503 });
      if (url.includes("atom")) return new Response(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>CBS Sports NBA</title><entry><title>Knicks complete a major trade</title><link href="https://example.com/knicks-trade" rel="alternate"/><updated>2026-10-19T10:00:00Z</updated><summary>New York reshapes its NBA roster.</summary></entry></feed>`, { headers: { "Content-Type": "application/atom+xml" } });
      return new Response(`<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>ESPN NBA</title><item><title>Curry scores 40 in Warriors win</title><link>https://example.com/curry</link><pubDate>Sun, 19 Oct 2026 09:00:00 GMT</pubDate><description><![CDATA[Stephen Curry leads Golden State with 40 points.]]></description><content:encoded><![CDATA[<article><p>Stephen Curry scored 40 points as Golden State won.</p><p>${"The Warriors controlled the second half with ball movement and timely defense. ".repeat(8)}</p></article>]]></content:encoded><media:content url="https://example.com/curry.jpg" type="image/jpeg"/></item></channel></rss>`, { headers: { "Content-Type": "application/rss+xml" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const provider = new RssNewsProvider([
      { url: "https://feeds.example/rss", name: "ESPN NBA", trustedNba: true },
      { url: "https://feeds.example/atom", name: "CBS Sports NBA", trustedNba: true },
      { url: "https://feeds.example/failed", name: "Failed feed", trustedNba: true },
    ]);
    const articles = await provider.getLatestArticles();
    expect(articles).toHaveLength(2);
    expect(articles.find((article) => article.url.endsWith("/curry"))).toMatchObject({ source: "ESPN NBA", teamIds: ["gsw"], playerIds: ["stephen-curry"], imageUrl: "https://example.com/curry.jpg", articleTextStatus: "rss-content" });
    expect(articles.find((article) => article.url.endsWith("/curry"))?.articleText).toContain("controlled the second half");
    expect(articles.find((article) => article.url.endsWith("knicks-trade"))).toMatchObject({ source: "CBS Sports NBA", teamIds: ["nyk"], tags: expect.arrayContaining(["nba", "roster"]) });
  });
});

describe("composite news", () => {
  it("keeps RSS as the primary copy, backfills from NewsAPI, and deduplicates", async () => {
    const article = (id: string, title: string, url: string, source: string): NewsArticle => ({ id, title, summary: `${title} summary`, source, publishedAt: "2026-10-19T10:00:00.000Z", url, teamIds: ["gsw"], playerIds: [], tags: ["nba"] });
    const rss: NewsProvider = { name: "rss", async getLatestArticles() { return [article("rss-1", "Warriors update", "https://example.com/story?utm_source=rss", "ESPN NBA")]; } };
    const newsApi: NewsProvider = { name: "newsapi", async getLatestArticles() { return [article("api-duplicate", "Warriors update", "https://example.com/story", "NewsAPI"), article("api-2", "NBA trade roundup", "https://example.com/trades", "NewsAPI")]; } };
    const articles = await new CompositeNewsProvider([rss, newsApi]).getLatestArticles();
    expect(articles.map((item) => item.id)).toEqual(["rss-1", "api-2"]);
    expect(articles[0].source).toBe("ESPN NBA");
  });
});
