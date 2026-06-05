import { describe, it, expect } from "vitest";
import {
  HERO_FLOATING_PRODUCTS,
  POPULAR_CATEGORIES,
  TRUST_STATS,
  TRUST_POINTS,
  BRAND_NAMES,
  CATEGORY_CARDS,
} from "./heroConfig";

describe("HERO_FLOATING_PRODUCTS", () => {
  it("has at least one product", () => {
    expect(HERO_FLOATING_PRODUCTS.length).toBeGreaterThan(0);
  });

  it("every product has title, slug, image, stock, and position", () => {
    for (const p of HERO_FLOATING_PRODUCTS) {
      expect(p.title).toBeTruthy();
      expect(p.slug).toBeTruthy();
      expect(p.image).toBeTruthy();
      expect(p.stock).toBeTruthy();
      expect(p.position).toBeDefined();
      expect(typeof p.delay).toBe("number");
    }
  });

  it("stock values are from allowed set", () => {
    const allowed = new Set(["In Stock", "Ready To Dispatch", "Bulk Available"]);
    for (const p of HERO_FLOATING_PRODUCTS) {
      expect(allowed.has(p.stock)).toBe(true);
    }
  });
});

describe("POPULAR_CATEGORIES", () => {
  it("has at least one category", () => {
    expect(POPULAR_CATEGORIES.length).toBeGreaterThan(0);
  });

  it("every entry has name, slug, and image", () => {
    for (const c of POPULAR_CATEGORIES) {
      expect(c.name).toBeTruthy();
      expect(c.slug).toBeTruthy();
      expect(c.image).toBeTruthy();
    }
  });
});

describe("TRUST_STATS", () => {
  it("has multiple stats", () => {
    expect(TRUST_STATS.length).toBeGreaterThanOrEqual(3);
  });

  it("every stat has a label", () => {
    for (const s of TRUST_STATS) {
      expect(s.label).toBeTruthy();
    }
  });

  it("numeric stats have value and suffix", () => {
    const numericStats = TRUST_STATS.filter(
      (s): s is { label: string; value: number; suffix: string } =>
        "value" in s,
    );
    for (const s of numericStats) {
      expect(typeof s.value).toBe("number");
      expect(typeof s.suffix).toBe("string");
    }
  });
});

describe("TRUST_POINTS", () => {
  it("is a non-empty array of strings", () => {
    expect(TRUST_POINTS.length).toBeGreaterThan(0);
    for (const p of TRUST_POINTS) {
      expect(typeof p).toBe("string");
      expect(p.length).toBeGreaterThan(0);
    }
  });
});

describe("BRAND_NAMES", () => {
  it("is a non-empty array of strings", () => {
    expect(BRAND_NAMES.length).toBeGreaterThan(0);
    for (const b of BRAND_NAMES) {
      expect(typeof b).toBe("string");
    }
  });
});

describe("CATEGORY_CARDS", () => {
  it("has at least one card", () => {
    expect(CATEGORY_CARDS.length).toBeGreaterThan(0);
  });

  it("every card has required fields", () => {
    for (const c of CATEGORY_CARDS) {
      expect(c.name).toBeTruthy();
      expect(c.slug).toBeTruthy();
      expect(c.coverImage).toBeTruthy();
      expect(typeof c.count).toBe("number");
      expect(c.gradientFrom).toBeTruthy();
      expect(c.gradientTo).toBeTruthy();
      expect(c.iconColor).toBeTruthy();
    }
  });
});
