import { describe, it, expect } from "vitest";
import { COOKIE_NAME, ONE_YEAR_MS } from "./const";

describe("shared/const", () => {
  it("COOKIE_NAME is the expected session cookie name", () => {
    expect(COOKIE_NAME).toBe("app_session_id");
  });

  it("ONE_YEAR_MS equals milliseconds in 365 days", () => {
    const expected = 1000 * 60 * 60 * 24 * 365;
    expect(ONE_YEAR_MS).toBe(expected);
  });
});
