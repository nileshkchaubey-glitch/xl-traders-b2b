import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_THEMES, isSiteTheme } from "./siteTheme";
import { settingsService } from "./settingsService";
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: database }));
beforeEach(() => {
  database.from.mockReset();
  settingsService.invalidate();
});
describe("site theme saves", () => {
  it("supports exactly the five current themes and rejects unknown values", () => {
    expect(SITE_THEMES).toEqual([
      "default",
      "diwali",
      "holi",
      "monsoon",
      "independence",
    ]);
    expect(SITE_THEMES.every(isSiteTheme)).toBe(true);
    expect(isSiteTheme("other")).toBe(false);
  });
  it("notifies mounted subscribers only after a successful save", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    database.from.mockReturnValue({ upsert });
    const listener = vi.fn();
    const unsubscribe = settingsService.subscribe(listener);
    try {
      await settingsService.updateContent("site_theme", { theme: "diwali" });
      expect(upsert.mock.calls[0][0]).toMatchObject({
        key: "site_theme",
        value: { theme: "diwali" },
      });
      expect(listener).toHaveBeenCalledExactlyOnceWith("site_theme");
      expect(await settingsService.getContent("site_theme")).toEqual({
        theme: "diwali",
      });
      upsert.mockResolvedValue({ error: new Error("Denied") });
      await expect(
        settingsService.updateContent("site_theme", { theme: "holi" })
      ).rejects.toThrow("Denied");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(await settingsService.getContent("site_theme")).toEqual({
        theme: "diwali",
      });
      unsubscribe();
      upsert.mockResolvedValue({ error: null });
      await settingsService.updateContent("site_theme", { theme: "default" });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribe();
    }
  });
  it("rejects unsupported themes before database access", async () => {
    await expect(
      settingsService.updateContent("site_theme", { theme: "other" } as any)
    ).rejects.toThrow("supported site theme");
    expect(database.from).not.toHaveBeenCalled();
  });
});
