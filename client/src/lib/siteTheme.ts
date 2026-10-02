/** Theme changes accent/hero colours only, never ordering or layout. */
export const SITE_THEMES = [
  "default",
  "diwali",
  "holi",
  "monsoon",
  "independence",
] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];
export function isSiteTheme(value: unknown): value is SiteTheme {
  return (
    typeof value === "string" &&
    (SITE_THEMES as readonly string[]).includes(value)
  );
}
