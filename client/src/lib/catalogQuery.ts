// Pure catalogue query resolution — no React, no Supabase, so it is unit
// testable and the composition rule below has one home.
//
// WHY THIS MODULE EXISTS
// `applyPublicScalarFilters` in productService has ALWAYS composed: it applies
// categoryId, categoryIds, brand and search to the same query, ANDed. The
// Catalog page did not. Its `buildFilters()` was a chain of early returns —
// search beat brand beat group beat category — so picking a brand silently
// discarded the category the customer had chosen. The capability was there;
// only the caller threw it away.
import type { Category } from "@/lib/supabase";
import type {
  PublicProductFilters,
  PublicProductSort,
} from "@/lib/productService";

export const CATALOG_SORTS = [
  "newest",
  "name",
  "price-low",
  "price-high",
] as const;

/** Sorts a signed-out visitor must never be offered. anon holds no SELECT
 *  grant on `price`, and Postgres refuses ORDER BY on an unreadable column
 *  exactly as it refuses WHERE — see STOREFRONT_RULES §1.3. */
const PRICE_SORTS: PublicProductSort[] = ["price-low", "price-high"];

export function isPriceSort(sort: PublicProductSort): boolean {
  return PRICE_SORTS.includes(sort);
}

/** Coerce anything unrecognised (or price-sorted while signed out) to a sort
 *  that is always legal. Reading sort from the URL means it is user input. */
export function parseSort(
  raw: string | null,
  canSortByPrice: boolean
): PublicProductSort {
  const sort = (CATALOG_SORTS as readonly string[]).includes(raw ?? "")
    ? (raw as PublicProductSort)
    : "newest";
  return isPriceSort(sort) && !canSortByPrice ? "newest" : sort;
}

export interface CatalogSelection {
  /** Category slug. Mutually exclusive with `group` — two granularities of
   *  one axis, not two axes. */
  category: string | null;
  group: string | null;
  /** Composes WITH category/group. */
  brand: string | null;
  /** Composes with everything. */
  search: string;
  sort: PublicProductSort;
}

export const EMPTY_SELECTION: CatalogSelection = {
  category: null,
  group: null,
  brand: null,
  search: "",
  sort: "newest",
};

export function parseSelection(
  params: URLSearchParams,
  canSortByPrice: boolean
): CatalogSelection {
  return {
    category: params.get("category") || null,
    group: params.get("group") || null,
    brand: params.get("brand") || null,
    search: params.get("search") || "",
    sort: parseSort(params.get("sort"), canSortByPrice),
  };
}

/** Serialise back to a query string. Defaults are omitted so a bare `/catalog`
 *  stays bare and the URL reads as what the customer actually chose. */
export function selectionToQuery(sel: CatalogSelection): string {
  const params = new URLSearchParams();
  if (sel.category) params.set("category", sel.category);
  if (sel.group) params.set("group", sel.group);
  if (sel.brand) params.set("brand", sel.brand);
  if (sel.search) params.set("search", sel.search);
  if (sel.sort !== "newest") params.set("sort", sel.sort);
  return params.toString();
}

export function isEmptySelection(sel: CatalogSelection): boolean {
  return !sel.category && !sel.group && !sel.brand && !sel.search;
}

export type CatalogQuery =
  /** Categories have not arrived yet — a category/group selection cannot be
   *  resolved to ids, so querying now would briefly show the whole catalogue
   *  under a specific heading. */
  | { status: "pending" }
  /** The selected slug/group matches nothing we can show. Deliberately NOT
   *  "no filter": the old code returned {} here, which rendered EVERY product
   *  under that category's name. A wrong answer is worse than an empty one,
   *  and this got likelier the moment the sidebar went live-only — a slug for
   *  a category with no published products no longer resolves. */
  | { status: "unknown"; what: string }
  | { status: "ready"; filters: PublicProductFilters };

export function resolveCatalogQuery(
  sel: CatalogSelection,
  categories: Category[],
  categoriesLoaded: boolean
): CatalogQuery {
  const needsCategories = Boolean(sel.category || sel.group);
  if (needsCategories && !categoriesLoaded) return { status: "pending" };

  const filters: PublicProductFilters = {};
  if (sel.search) filters.search = sel.search;
  if (sel.brand) filters.brand = sel.brand;

  if (sel.category) {
    const cat = categories.find(c => c.slug === sel.category);
    if (!cat) return { status: "unknown", what: sel.category };
    filters.categoryId = cat.id;
  } else if (sel.group) {
    const ids = categories
      .filter(c => c.group_name === sel.group)
      .map(c => c.id);
    if (!ids.length) return { status: "unknown", what: sel.group };
    filters.categoryIds = ids;
  }

  return { status: "ready", filters };
}
