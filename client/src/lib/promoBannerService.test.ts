import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  promoBannerService,
  safeBannerUrl,
  type BannerInput,
} from "./promoBannerService";
const database = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: database }));
const input: BannerInput = {
  headline: "Example only",
  rate_line: null,
  image_url: null,
  link_target: "/products",
  position: "home_top",
  sort_order: 0,
  is_active: false,
  starts_at: null,
  ends_at: null,
};
beforeEach(() => {
  database.from.mockReset();
});

describe("safe public banner targets", () => {
  it.each([
    "javascript:alert(1)",
    "data:image/png;base64,aGVsbG8=",
    "//evil.test",
    "/\\evil.test",
    "https://name:secret@example.test",
    "https://example.test/a b",
  ])("rejects unsafe target %s", value =>
    expect(safeBannerUrl(value)).toBeNull()
  );
  it("allows same-site paths and credential-free HTTPS", () => {
    expect(safeBannerUrl(" /products?category=test ")).toBe(
      "/products?category=test"
    );
    expect(safeBannerUrl("https://example.test/image.webp")).toBe(
      "https://example.test/image.webp"
    );
  });
});
describe("banner management service", () => {
  it("filters scheduling and activation for storefront reads without product price fields", async () => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    for (const method of [query.select, query.eq, query.or])
      method.mockReturnValue(query);
    database.from.mockReturnValue(query);
    expect(await promoBannerService.getByPosition("home_top")).toEqual([]);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.or).toHaveBeenCalledWith(
      expect.stringMatching(/^starts_at.is.null,starts_at.lte./)
    );
    expect(query.or).toHaveBeenCalledWith(
      expect.stringMatching(/^ends_at.is.null,ends_at.gt./)
    );
    expect(query.select.mock.calls[0][0].split(",")).not.toContain("price");
  });
  it("creates an inactive banner even if the caller requests activation", async () => {
    const insert = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({
          data: { id: "fixture", ...input },
          error: null,
        }),
      }),
    });
    database.from.mockReturnValue({ insert });
    await promoBannerService.create({ ...input, is_active: true });
    expect(insert).toHaveBeenCalledWith({ ...input, is_active: false });
  });
  it.each([
    [{ headline: " " }, "headline"],
    [{ order_unit: "pcs", sort_order: 1.5 }, "whole number"],
    [{ link_target: "javascript:alert(1)" }, "HTTPS"],
    [{ image_url: "data:image/png;base64,aGVsbG8=" }, "HTTPS"],
    [{ starts_at: "not-a-date" }, "valid scheduling date"],
    [
      { starts_at: "2026-10-04T10:00:00Z", ends_at: "2026-10-03T10:00:00Z" },
      "End must",
    ],
  ])("rejects invalid settings before any write", async (patch, error) => {
    await expect(
      promoBannerService.create({ ...input, ...patch })
    ).rejects.toThrow(error);
    expect(database.from).not.toHaveBeenCalled();
  });
  it("updates the exact target with normalized dates and a whitelisted payload", async () => {
    const eq = vi.fn().mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "fixture" }, error: null }),
      }),
    });
    const update = vi.fn().mockReturnValue({ eq });
    database.from.mockReturnValue({ update });
    await promoBannerService.update("fixture", {
      ...input,
      is_active: true,
      starts_at: "2026-10-02T10:00:00+05:30",
      injected: "ignored",
    } as BannerInput);
    expect(eq).toHaveBeenCalledWith("id", "fixture");
    expect(update.mock.calls[0][0]).toMatchObject({
      is_active: true,
      starts_at: "2026-10-02T04:30:00.000Z",
    });
    expect(update.mock.calls[0][0]).not.toHaveProperty("injected");
  });
  it("propagates denied management writes and tolerates failed public reads", async () => {
    database.from.mockReturnValue({
      insert: () => ({
        select: () => ({
          single: async () => ({ error: new Error("Denied") }),
        }),
      }),
    });
    await expect(promoBannerService.create(input)).rejects.toThrow("Denied");
    database.from.mockImplementation(() => {
      throw new Error("Unavailable");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const banners = await promoBannerService.getByPosition("home_top");
      expect(banners).toEqual([]);
      expect(log.mock.calls.length).toBe(1);
    } finally {
      log.mockRestore();
    }
  });
});
