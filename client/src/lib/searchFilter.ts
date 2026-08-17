/**
 * Search-term escaping for PostgREST `or()` filters.
 *
 * ── The bug this exists to fix ───────────────────────────────────────────
 * `or()` takes a COMMA-SEPARATED list of predicates inside parentheses:
 *
 *     or=(name.ilike.%term%,description.ilike.%term%)
 *
 * Interpolating a raw user term into that string means the term's own commas
 * and parens are read as filter GRAMMAR. Verified live against the project:
 *
 *     search "cup"                         -> 7 rows
 *     search "cup,box"                     -> HTTP 400, catalogue breaks
 *     search "zzzz%,is_active.eq.false,..." -> parsed as extra predicates
 *
 * A comma is not exotic — "cup, box" or a product name containing one is an
 * ordinary thing to type, and it took the whole listing down.
 *
 * ── On the security framing ──────────────────────────────────────────────
 * The injected predicate DOES parse, but it cannot leak data: `anon`'s RLS
 * policy independently enforces `is_active AND status = 'published'`, and the
 * query also applies those as its own `.eq()` filters. An attacker can perturb
 * which rows come back WITHIN the already-public set, and nothing more. So this
 * is a correctness and availability bug first — the earlier characterisation of
 * it as a disclosure risk was too strong, and this note corrects it.
 *
 * ── Why quoting rather than stripping ────────────────────────────────────
 * The admin path stripped `[,()]` from the term. That works but silently
 * mangles what the user typed. PostgREST accepts a DOUBLE-QUOTED value, inside
 * which commas and parens are literal — so the user's term survives intact:
 *
 *     or=(name.ilike."%Cup (250ml)%",description.ilike."%Cup (250ml)%")
 *
 * Verified: commas, parens, embedded quotes, backslashes and unbalanced parens
 * all return 200 with the quoted form.
 */

/**
 * The quoted, escaped `ilike` value for a user search term — including the
 * surrounding `%` wildcards and the double quotes.
 *
 * Backslashes are escaped first (so an escaped quote is not itself re-escaped),
 * then double quotes, since those are the two characters that can terminate or
 * confuse the quoted value.
 *
 * NOTE: `%` and `*` inside the term remain LIKE wildcards. That is standard
 * `ilike` behaviour, it cannot error and it cannot widen beyond the RLS-visible
 * set, so it is left as a search feature rather than escaped away.
 */
export function ilikeValue(term: string): string {
  const escaped = term
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');
  return `"%${escaped}%"`;
}

/**
 * A complete `or()` argument matching `term` against several columns.
 *
 * Returns null for an empty term so callers can skip the filter entirely
 * rather than emit `ilike."%%"`, which matches everything.
 */
export function orIlike(term: string, columns: string[]): string | null {
  const t = term.trim();
  if (!t || columns.length === 0) return null;
  const value = ilikeValue(t);
  return columns.map(c => `${c}.ilike.${value}`).join(",");
}
