import type { NewsArticle } from "./models";

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  lt: "<",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  rsquo: "’",
};

export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hexadecimal = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
      try { return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match; } catch { return match; }
    }
    return namedEntities[entity.toLowerCase()] ?? match;
  });
}

export function cleanNewsText(value: string) {
  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
}

export function cleanNewsArticle(article: NewsArticle): NewsArticle {
  return {
    ...article,
    title: cleanNewsText(article.title),
    summary: cleanNewsText(article.summary),
    source: cleanNewsText(article.source),
    articleText: article.articleText?.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() || undefined,
  };
}

export function publicNewsArticle(article: NewsArticle): NewsArticle {
  const { articleText: _articleText, articleTextFetchedAt: _articleTextFetchedAt, articleTextStatus: _articleTextStatus, articleTextHash: _articleTextHash, ...publicArticle } = article;
  return publicArticle;
}
