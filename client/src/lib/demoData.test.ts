import { describe, it, expect } from "vitest";
import { demoCategories, demoProducts } from "./demoData";

describe("demoCategories", () => {
  it("contains at least one category", () => {
    expect(demoCategories.length).toBeGreaterThan(0);
  });

  it("every category has required fields", () => {
    for (const cat of demoCategories) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(cat.slug).toBeTruthy();
      expect(cat.is_active).toBe(true);
      expect(typeof cat.display_order).toBe("number");
    }
  });

  it("has unique ids", () => {
    const ids = demoCategories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has unique slugs", () => {
    const slugs = demoCategories.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("demoProducts", () => {
  it("contains at least one product", () => {
    expect(demoProducts.length).toBeGreaterThan(0);
  });

  it("every product has required fields", () => {
    for (const p of demoProducts) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category_id).toBeTruthy();
      expect(p.unit_of_measure).toBeTruthy();
      expect(p.is_active).toBe(true);
      expect(typeof p.display_order).toBe("number");
    }
  });

  it("has unique ids", () => {
    const ids = demoProducts.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every product references a valid category", () => {
    const catIds = new Set(demoCategories.map((c) => c.id));
    for (const p of demoProducts) {
      expect(catIds.has(p.category_id)).toBe(true);
    }
  });

  it("every product has a non-negative price", () => {
    for (const p of demoProducts) {
      if (p.price !== undefined) {
        expect(p.price).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
