import { useCallback, useEffect, useRef, useState } from "react";
import { productService, categoryService } from "@/lib/productService";
import { healthService } from "@/lib/healthService";
import { AttentionFilter, ATTENTION_FIELD } from "@/lib/catalogHealth";
import { Product, Category } from "@/lib/supabase";

const PAGE_SIZE = 50;

export type GridStatusFilter =
  | "all"
  | "active"
  | "inactive"
  | "featured"
  | "draft"
  | "published";

export type GridSortField = "name" | "price" | "created_at";

// Thin wrapper around productService.getAllAdmin() + healthService — no query
// logic lives here beyond wiring filter state to the existing service calls.
export function useProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [status, setStatus] = useState<GridStatusFilter>("all");
  const [attention, setAttention] = useState<AttentionFilter>(null);
  const [sortField, setSortField] = useState<GridSortField>("created_at");
  const [sortAscending, setSortAscending] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ids = attention
        ? await healthService.getIdsMissing(ATTENTION_FIELD[attention])
        : undefined;
      const result = await productService.getAllAdmin({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        categoryId,
        status,
        sortField,
        sortAscending,
        ids,
      });
      setProducts(result.data);
      setTotalCount(result.count);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryId, status, attention, sortField, sortAscending]);

  // Resolves EVERY product id matching the active filters (all pages) — backs
  // the grid's "select all N matching" bulk action. Reuses the same
  // healthService + productService filter path as load() so it can't drift.
  const getMatchingIds = useCallback(async (): Promise<string[]> => {
    const ids = attention
      ? await healthService.getIdsMissing(ATTENTION_FIELD[attention])
      : undefined;
    return productService.getAdminMatchingIds({
      search: debouncedSearch,
      categoryId,
      status,
      ids,
    });
  }, [debouncedSearch, categoryId, status, attention]);

  const hasFetched = useRef(false);
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
    categoryService.getAll().then(setCategories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skipFirst = useRef(true);
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, categoryId, status, attention, sortField, sortAscending]);

  return {
    products,
    setProducts,
    categories,
    totalCount,
    loading,
    search,
    setSearch,
    categoryId,
    setCategoryId: (v: string) => {
      setCategoryId(v);
      setPage(1);
    },
    status,
    setStatus: (v: GridStatusFilter) => {
      setStatus(v);
      setPage(1);
    },
    attention,
    setAttention: (v: AttentionFilter) => {
      setAttention(v);
      setPage(1);
    },
    sortField,
    sortAscending,
    setSort: (field: GridSortField, ascending: boolean) => {
      setSortField(field);
      setSortAscending(ascending);
      setPage(1);
    },
    page,
    setPage,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
    reload: load,
    getMatchingIds,
  };
}
