import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";

import {
  CatalogSelection,
  EMPTY_SELECTION,
  isPriceSort,
  parseSelection,
  selectionToQuery,
} from "@/lib/catalogQuery";
import { useAuthStore } from "@/lib/authStore";

/** Typing must not write a history entry per keystroke, and must not fire a
 *  query per keystroke either — the list and its count are two round trips. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The URL is the single source of truth for what the catalogue is showing.
 *
 * The previous page mirrored the URL into useState at mount and then only ever
 * WROTE to it. Back and Forward moved the address bar and changed nothing on
 * screen, and a shared link worked only because it happened to be read once.
 * `useSearch()` is reactive, so deriving the selection from it each render
 * makes browser navigation work by construction rather than by an extra effect.
 *
 * `view` is deliberately NOT here: grid-vs-list is a viewing preference, not
 * part of what the link points at.
 */
export function useCatalogFilters() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { isAuthenticated } = useAuthStore();

  // Signing out while a price sort is active would otherwise leave a <select>
  // showing an option that no longer exists — and a query anon cannot run.
  // Parsing with the current auth state coerces it on the spot.
  const selection = useMemo(
    () => parseSelection(new URLSearchParams(search), isAuthenticated),
    [search, isAuthenticated]
  );

  const navigate = useCallback(
    (next: CatalogSelection, replace = false) => {
      const qs = selectionToQuery(next);
      setLocation(qs ? `/catalog?${qs}` : "/catalog", { replace });
    },
    [setLocation]
  );

  // A price sort surviving in the URL after sign-out is coerced above for
  // display; rewrite the URL too so a copied link is honest about what it does.
  useEffect(() => {
    if (
      !isAuthenticated &&
      isPriceSort(parseSelection(new URLSearchParams(search), true).sort)
    ) {
      navigate(selection, true);
    }
  }, [isAuthenticated, search, selection, navigate]);

  /** Category and group are one axis: picking either clears the other. Brand
   *  and search are orthogonal and are preserved — that is the whole point. */
  const setCategory = useCallback(
    (slug: string | null) =>
      navigate({ ...selection, category: slug, group: null }),
    [navigate, selection]
  );

  const setGroup = useCallback(
    (group: string | null) => navigate({ ...selection, group, category: null }),
    [navigate, selection]
  );

  const setBrand = useCallback(
    (brand: string | null) => navigate({ ...selection, brand }),
    [navigate, selection]
  );

  const setSort = useCallback(
    (sort: CatalogSelection["sort"]) => navigate({ ...selection, sort }),
    [navigate, selection]
  );

  const clearAll = useCallback(
    () => navigate({ ...EMPTY_SELECTION, sort: selection.sort }),
    [navigate, selection.sort]
  );

  // ── Search: local input, debounced into the URL ───────────────────────────
  const [searchInput, setSearchInput] = useState(selection.search);

  // Re-sync when the URL search changes from anywhere other than this input —
  // Back/Forward, the "clear" chip, or a link into /catalog?search=…
  useEffect(() => setSearchInput(selection.search), [selection.search]);

  useEffect(() => {
    const next = searchInput.trim();
    if (next === selection.search) return;
    const id = setTimeout(
      // replace, not push: otherwise Back walks the customer through every
      // keystroke they ever typed.
      () => navigate({ ...selection, search: next }, true),
      SEARCH_DEBOUNCE_MS
    );
    return () => clearTimeout(id);
  }, [searchInput, selection, navigate]);

  return {
    selection,
    searchInput,
    setSearchInput,
    setCategory,
    setGroup,
    setBrand,
    setSort,
    clearAll,
  };
}

export type CatalogFilters = ReturnType<typeof useCatalogFilters>;
