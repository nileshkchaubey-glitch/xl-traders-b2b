import { beforeEach, describe, expect, it, vi } from "vitest";
const { from, query } = vi.hoisted(() => ({
  from: vi.fn(),
  query: { select: vi.fn(), in: vi.fn(), upsert: vi.fn() },
}));
vi.mock("./supabase", () => ({ supabase: { from } }));
import { businessSettingsService } from "./businessSettingsService";
beforeEach(() => {
  vi.resetAllMocks();
  from.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.upsert.mockReturnValue(query);
});
describe("live key/value business settings", () => {
  it("loads multiple records using explicit columns and known keys", async () => {
    query.in.mockResolvedValue({
      data: [
        { key: "phone", value: "123" },
        { key: "email", value: "a@example.invalid" },
        { key: "unknown", value: "untouched" },
      ],
      error: null,
    });
    expect(await businessSettingsService.get()).toEqual({
      phone: "123",
      email: "a@example.invalid",
    });
    expect(query.select).toHaveBeenCalledWith("key,value");
    expect(query.in).toHaveBeenCalledWith(
      "key",
      expect.arrayContaining(["whatsapp", "working_hours"])
    );
  });
  it("empty table is an empty form, not fabricated defaults", async () => {
    query.in.mockResolvedValue({ data: [], error: null });
    expect(await businessSettingsService.get()).toEqual({});
  });
  it("does not hide denied loads", async () => {
    query.in.mockResolvedValue({ data: null, error: Error("Denied") });
    await expect(businessSettingsService.get()).rejects.toThrow("Denied");
  });
  it("upserts changed keys only on actual unique key and verifies response", async () => {
    query.select.mockResolvedValue({
      data: [{ key: "phone", value: "456" }],
      error: null,
    });
    expect(
      await businessSettingsService.saveChanges(
        { phone: "123", email: "keep" },
        { phone: "456", email: "keep" }
      )
    ).toEqual({ phone: "456", email: "keep" });
    expect(query.upsert).toHaveBeenCalledWith(
      [{ key: "phone", value: "456", updated_at: expect.any(String) }],
      { onConflict: "key" }
    );
  });
  it("unchanged settings make no database write", async () => {
    expect(
      await businessSettingsService.saveChanges(
        { phone: "123" },
        { phone: "123" }
      )
    ).toEqual({ phone: "123" });
    expect(from).not.toHaveBeenCalled();
  });
  it("does not fake a save on write denial", async () => {
    query.select.mockResolvedValue({ data: null, error: Error("RLS denied") });
    await expect(
      businessSettingsService.saveChanges({ phone: "123" }, { phone: "456" })
    ).rejects.toThrow("RLS denied");
  });
  it.each([null, [], [{ key: "email", value: "456" }]])(
    "requires verified returned target/value",
    async data => {
      query.select.mockResolvedValue({ data, error: null });
      await expect(
        businessSettingsService.saveChanges({ phone: "123" }, { phone: "456" })
      ).rejects.toThrow("verify saved");
    }
  );
  it("rejects unsupported keys before writing", async () => {
    await expect(
      businessSettingsService.saveChanges({}, { is_admin: "true" } as never)
    ).rejects.toThrow("Unsupported");
    expect(from).not.toHaveBeenCalled();
  });
});
