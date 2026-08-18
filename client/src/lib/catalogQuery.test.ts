import { describe, expect, it } from "vitest";

import {
  EMPTY_SELECTION,
  isEmptySelection,
  parseSelection,
  parseSort,
  resolveCatalogQuery,
  selectionToQuery,
  type CatalogSelection,
} from "./catalogQuery";
import type { Category } from "./supabase";

const cat = (id: string, slug: string, group: string): Category =>
  ({ id, slug, name: slug, group_name: group }) as Category;

const CATEGORIES: Category[] = [
  cat("c1", "carry-bags", "Packaging"),
  cat("c2", "corrugated-boxes", "Packaging"),
  cat("c3", "gloves", "Cleaning"),
];

const sel = (patch: Partial<CatalogSelection> = {}): CatalogSelection => ({
  ...EMPTY_SELECTION,
  ...patch,
});

describe("parseSort", () => {
  it("falls back to newest for anything unrecognised", () => {
    expect(parseSort("nonsense", true)).toBe("newest");
    expect(parseSort(null, true)).toBe("newest");
  });

  // anon has no SELECT grant on `price`; Postgres refuses ORDER BY on an
  // unreadable column, so a guest asking for it got an EMPTY catalogue.
  it("refuses price sorts when the visitor cannot sort by price", () => {
    expect(parseSort("price-low", false)).toBe("newest");
    expect(parseSort("price-high", false)).toBe("newest");
  });

  it("allows price sorts when signed in", () => {
    expect(parseSort("price-low", true)).toBe("price-low");
  });
});

describe("resolveCatalogQuery", () => {
  it("ANDs category, brand and search together", () => {
    const query = resolveCatalogQuery(
      sel({ category: "carry-bags", brand: "Packworld", search: "liner" }),
      CATEGORIES,
      true
    );
    expect(query).toEqual({
      status: "ready",
      filters: { search: "liner", brand: "Packworld", categoryId: "c1" },
    });
  });

  // The regression this whole change exists for: buildFilters() used to
  // early-return on search, so a category the customer had picked was silently
  // discarded the moment they typed.
  it("does not let search discard the category", () => {
    const query = resolveCatalogQuery(
      sel({ category: "carry-bags", search: "liner" }),
      CATEGORIES,
      true
    );
    expect(query).toMatchObject({ filters: { categoryId: "c1" } });
  });

  it("expands a group to every category id in it", () => {
    const query = resolveCatalogQuery(
      sel({ group: "Packaging" }),
      CATEGORIES,
      true
    );
    expect(query).toEqual({
      status: "ready",
      filters: { categoryIds: ["c1", "c2"] },
    });
  });

  it("prefers the narrower category when both are somehow set", () => {
    const query = resolveCatalogQuery(
      sel({ category: "gloves", group: "Packaging" }),
      CATEGORIES,
      true
    );
    expect(query).toMatchObject({ filters: { categoryId: "c3" } });
  });

  it("waits rather than querying before categories have loaded", () => {
    expect(
      resolveCatalogQuery(sel({ category: "carry-bags" }), [], false)
    ).toEqual({ status: "pending" });
  });

  it("does not wait when nothing needs a category lookup", () => {
    expect(resolveCatalogQuery(sel({ search: "cup" }), [], false)).toEqual({
      status: "ready",
      filters: { search: "cup" },
    });
  });

  // The old code returned {} for an unresolvable slug, which rendered the
  // ENTIRE catalogue under that category's heading. An empty answer is honest;
  // a wrong one is not.
  it("reports an unresolvable category instead of dropping the filter", () => {
    expect(
      resolveCatalogQuery(sel({ category: "does-not-exist" }), CATEGORIES, true)
    ).toEqual({ status: "unknown", what: "does-not-exist" });
  });

  it("reports an empty group the same way", () => {
    expect(
      resolveCatalogQuery(sel({ group: "Nonexistent" }), CATEGORIES, true)
    ).toEqual({ status: "unknown", what: "Nonexistent" });
  });
});

describe("selection <-> URL", () => {
  it("round-trips every axis", () => {
    const original = sel({
      category: "carry-bags",
      brand: "Packworld",
      search: "liner",
      sort: "name",
    });
    const parsed = parseSelection(
      new URLSearchParams(selectionToQuery(original)),
      true
    );
    expect(parsed).toEqual(original);
  });

  it("omits defaults so a bare /catalog stays bare", () => {
    expect(selectionToQuery(EMPTY_SELECTION)).toBe("");
  });

  it("encodes values that need it", () => {
    const qs = selectionToQuery(sel({ group: "Food & Packaging" }));
    expect(new URLSearchParams(qs).get("group")).toBe("Food & Packaging");
  });

  it("coerces a price sort out of a shared link when signed out", () => {
    const qs = selectionToQuery(sel({ sort: "price-low" }));
    expect(parseSelection(new URLSearchParams(qs), false).sort).toBe("newest");
    expect(parseSelection(new URLSearchParams(qs), true).sort).toBe(
      "price-low"
    );
  });
});

describe("isEmptySelection", () => {
  it("ignores sort", () => {
    expect(isEmptySelection(sel({ sort: "name" }))).toBe(true);
    expect(isEmptySelection(sel({ brand: "Packworld" }))).toBe(false);
  });
});
