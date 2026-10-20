import { describe, expect, it } from "vitest";
import { cleanNewsText, decodeHtmlEntities } from "@/lib/news-text";

describe("news text cleanup", () => {
  it("decodes zero-padded numeric and named HTML entities", () => {
    expect(decodeHtmlEntities("Warriors&#039; update &amp; reaction")).toBe("Warriors' update & reaction");
    expect(decodeHtmlEntities("&#x201C;NBA&#x201D;")).toBe("“NBA”");
  });

  it("normalizes whitespace after decoding", () => {
    expect(cleanNewsText("NBA&nbsp;  news\n today")).toBe("NBA news today");
  });
});
