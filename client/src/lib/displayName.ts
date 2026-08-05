/**
 * Presentation-only name normalisation for catalogue-authored text
 * (docs/DESIGN_SYSTEM.md §1.7b).
 *
 * The catalogue was entered by hand over time, so casing is inconsistent:
 * "Round Container" sits next to "BALLOON SET" in the same grid. Shouting one
 * tile among eleven quiet ones reads as an error, not as emphasis.
 *
 * This normalises ONLY the all-caps case, and only for display. The stored
 * value is untouched — admin keeps seeing the data as it is, exactly like
 * `brandLabel` (lib/brandUtils.ts) and for the same reason.
 */

/** Words that stay lowercase inside a title, unless they lead it. */
const MINOR = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

/**
 * Tokens that must keep their exact casing — they are not words, and
 * title-casing them ("Pvc", "Gsm") looks like a typo.
 */
const KEEP_AS_IS = new Set([
  "XL",
  "GST",
  "PVC",
  "PET",
  "PP",
  "HDPE",
  "LDPE",
  "GSM",
  "ML",
  "KG",
  "PCS",
  "OZ",
  "MM",
  "CM",
  "UV",
  "3D",
  "LED",
]);

function titleCaseWord(word: string, isFirst: boolean): string {
  if (!word) return word;
  if (KEEP_AS_IS.has(word.toUpperCase())) return word.toUpperCase();

  const lower = word.toLowerCase();
  if (!isFirst && MINOR.has(lower)) return lower;

  // Anything containing a digit is a spec token ("8x8x3", "150ML") — leave the
  // caller's separators alone and just lowercase the trailing unit.
  if (/\d/.test(word)) return lower;

  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/**
 * Title-case a name that is entirely upper-case; leave every other name alone.
 *
 * Deliberately narrow. A mixed-case name like "Paper Ice Cream Wati" is
 * already how the owner wants it, and re-casing everything would fight the
 * data rather than tidy it. Only SHOUTING is corrected.
 *
 *   "BALLOON SET"        → "Balloon Set"
 *   "CAP & GLOVES"       → "Cap & Gloves"
 *   "Round Container"    → "Round Container"   (untouched)
 *   "Paper Ice Cream Wati" → unchanged
 */
export function displayName(name?: string | null): string {
  const raw = (name ?? "").trim();
  if (!raw) return "";

  // Has any lowercase letter → the author chose this casing. Leave it.
  if (/[a-z]/.test(raw)) return raw;
  // No letters at all (pure spec string) → nothing to case.
  if (!/[A-Z]/.test(raw)) return raw;

  return raw
    .split(/(\s+|[/&+·-])/) // keep separators so "CAP & GLOVES" survives
    .map((tok, i) =>
      /^\s+$|^[/&+·-]$/.test(tok) ? tok : titleCaseWord(tok, i === 0)
    )
    .join("");
}
