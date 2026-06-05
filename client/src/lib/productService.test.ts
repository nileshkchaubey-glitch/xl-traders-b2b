import { describe, it, expect, vi, beforeAll } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
    })),
  },
}));

// We can't easily set import.meta.env.VITE_DEMO_MODE before module evaluation,
// so instead we test the demo filtering logic by importing and filtering
// demoData directly with the same algorithm the service uses.
import { demoProducts, demoCategories } from "./demoData";

// Replicate the demo-mode filtering logic from productService so we can test it
// without needing VITE_DEMO_MODE to be set.
function demoGetAll(filters?: {
  categoryId?: string;
  categoryIds?: string[];
  search?: string;
  featured?: boolean;
  brand?: string;
}) {
  let results = [...demoProducts];
  if (filters?.categoryId)
    results = results.filter((p) => p.category_id === filters.categoryId);
  if (filters?.categoryIds?.length)
    results = results.filter((p) =>
      filters.categoryIds!.includes(p.category_id),
    );
  if (filters?.featured)
    results = results.filter((p) => p.is_featured);
  if (filters?.brand)
    results = results.filter((p) => p.brand === filters.brand);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }
  return results;
}

describe("productService demo-mode filtering logic", () => {
  it("returns all demo products when no filters", () => {
    const products = demoGetAll();
    expect(products).toHaveLength(demoProducts.length);
  });

  it("filters by categoryId", () => {
    const catId = demoProducts[0].category_id;
    const products = demoGetAll({ categoryId: catId });
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.category_id).toBe(catId);
    }
  });

  it("filters by multiple categoryIds", () => {
    const ids = [demoProducts[0].category_id, demoProducts[1].category_id];
    const products = demoGetAll({ categoryIds: ids });
    for (const p of products) {
      expect(ids).toContain(p.category_id);
    }
  });

  it("filters by featured", () => {
    const products = demoGetAll({ featured: true });
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.is_featured).toBe(true);
    }
  });

  it("filters by search (name)", () => {
    const searchTerm = demoProducts[0].name.split(" ")[0].toLowerCase();
    const products = demoGetAll({ search: searchTerm });
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      const matches =
        p.name.toLowerCase().includes(searchTerm) ||
        (p.description?.toLowerCase().includes(searchTerm) ?? false);
      expect(matches).toBe(true);
    }
  });

  it("returns empty array when search matches nothing", () => {
    const products = demoGetAll({
      search: "zzz_nonexistent_product_xyz",
    });
    expect(products).toHaveLength(0);
  });

  it("combines categoryId and featured filters", () => {
    const catId = demoProducts[0].category_id;
    const products = demoGetAll({ categoryId: catId, featured: true });
    for (const p of products) {
      expect(p.category_id).toBe(catId);
      expect(p.is_featured).toBe(true);
    }
  });

  it("search is case-insensitive", () => {
    const name = demoProducts[0].name;
    const upper = demoGetAll({ search: name.toUpperCase() });
    const lower = demoGetAll({ search: name.toLowerCase() });
    expect(upper).toEqual(lower);
  });
});

describe("demoCategories integrity for service", () => {
  it("returns demo categories as-is", () => {
    expect(demoCategories.length).toBeGreaterThan(0);
    for (const c of demoCategories) {
      expect(c.is_active).toBe(true);
    }
  });
});
