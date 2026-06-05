import { describe, it, expect } from "vitest";
import { DAILY_SUGGESTIONS, type DailySuggestion } from "./dailySuggestions";

describe("DAILY_SUGGESTIONS", () => {
  it("is a non-empty array", () => {
    expect(DAILY_SUGGESTIONS.length).toBeGreaterThan(0);
  });

  it("every suggestion has a unique id", () => {
    const ids = DAILY_SUGGESTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every suggestion has required fields", () => {
    for (const s of DAILY_SUGGESTIONS) {
      expect(typeof s.id).toBe("number");
      expect(s.title).toBeTruthy();
      expect(s.note).toBeTruthy();
    }
  });

  it("priorities are from the allowed set", () => {
    const allowed = new Set(["High", "Medium", "Low"]);
    for (const s of DAILY_SUGGESTIONS) {
      expect(allowed.has(s.priority)).toBe(true);
    }
  });

  it("impacts are from the allowed set", () => {
    const allowed = new Set([
      "Conversion",
      "Design",
      "Catalog",
      "Mobile",
      "SEO",
    ]);
    for (const s of DAILY_SUGGESTIONS) {
      expect(allowed.has(s.impact)).toBe(true);
    }
  });
});
