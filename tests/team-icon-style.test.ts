import { expect, it } from "vitest";
import { teamIconStyle } from "@/lib/team-icon-style";

it("uses a team tint and theme-aware foreground with a neutral fallback", () => {
  expect(teamIconStyle("#552583").background).toContain("#552583 22%");
  expect(teamIconStyle("#552583").boxShadow).toContain("#552583 45%");
  expect(teamIconStyle().color).toBe("var(--ink)");
  expect(teamIconStyle("invalid")).toEqual(teamIconStyle());
});
