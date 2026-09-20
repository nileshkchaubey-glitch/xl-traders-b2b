import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  from: vi.fn(),
  auth: { getSession: vi.fn() },
}));
vi.mock("./supabase", () => ({ supabase: database }));
vi.mock("./demoData", () => ({
  demoCategories: [],
  demoProducts: [
    { id: "sku-match", name: "Paper cup", description: "Plain", sku: "XL0002", status: "published", is_active: true },
    { id: "other", name: "Foil", description: "Kitchen", sku: "XL0003", status: "published", is_active: true },
  ],
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("VITE_DEMO_MODE", "false");
  database.auth.getSession.mockResolvedValue({ data: { session: null } });
});
afterEach(() => vi.unstubAllEnvs());

describe("storefront SKU search", () => {
  it.each(["search", "listing", "count"])(
    "%s includes literal SKU matching and keeps public visibility filters",
    async surface => {
      const query: any = {};
      for (const method of ["select", "eq", "or", "order", "limit", "range"]) {
        query[method] = vi.fn(() => query);
      }
      query.then = (resolve: (value: unknown) => void) =>
        resolve({ data: [], count: 0, error: null });
      database.from.mockReturnValue(query);
      const { productService } = await import("./productService");

      // A comma-containing SKU must remain one literal search value, never
      // introduce a PostgREST predicate that could bypass the publish gate.
      const sku = " XL,0002 ";
      if (surface === "search") await productService.search(sku);
      if (surface === "listing") await productService.getAll({ search: sku });
      if (surface === "count") await productService.countPublished({ search: sku });

      expect(query.or).toHaveBeenCalledWith(
        'name.ilike."%XL,0002%",description.ilike."%XL,0002%",sku.ilike."%XL,0002%"'
      );
      expect(query.eq).toHaveBeenCalledWith("status", "published");
      expect(query.eq).toHaveBeenCalledWith("is_active", true);
      const selected = query.select.mock.calls[0][0].split(",");
      expect(selected).not.toContain("*");
      expect(selected).not.toContain("price");
      expect(selected).not.toContain("price_per_piece");
    }
  );

  it("finds a case-insensitive SKU in demo search, listing, and count", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    const { productService } = await import("./productService");
    const term = " xl0002 ";
    expect(await productService.search(term)).toMatchObject([{ id: "sku-match" }]);
    expect(await productService.getAll({ search: term })).toMatchObject([{ id: "sku-match" }]);
    expect(await productService.countPublished({ search: term })).toBe(1);
    expect(database.from).not.toHaveBeenCalled();
  });
});
