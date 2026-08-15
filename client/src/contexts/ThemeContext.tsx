import React, { createContext, useContext, useEffect, useState } from "react";
import { settingsService } from "@/lib/settingsService";

/**
 * Festival theming.
 *
 * ONE setting (`site_content.site_theme`), five values, changing EXACTLY two
 * things: an accent colour and the hero gradient. Never layout, never prices.
 *
 * That guarantee is structural, not a convention. The value is written onto
 * `<html data-xl-theme="…">` and the only consumers are the CSS custom
 * properties in index.css. **No component reads the theme.** There is therefore
 * no scope anywhere in the app in which a theme value could reach a layout or
 * pricing decision, which is a much stronger property than "we agreed not to".
 *
 * Note this file previously provided a light/dark mode. That was a different
 * axis, unused by the storefront, and it is replaced rather than extended.
 */
export const SITE_THEMES = [
  "default",
  "diwali",
  "holi",
  "monsoon",
  "independence",
] as const;

export type SiteTheme = (typeof SITE_THEMES)[number];

function isSiteTheme(v: unknown): v is SiteTheme {
  return typeof v === "string" && (SITE_THEMES as readonly string[]).includes(v);
}

const ThemeContext = createContext<SiteTheme>("default");

/** Read-only. Exposed for a future admin preview; the storefront never calls it. */
export const useSiteTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<SiteTheme>("default");

  useEffect(() => {
    let cancelled = false;
    settingsService
      .getContent("site_theme")
      .then(v => {
        if (cancelled) return;
        // Unknown values fall back to default rather than being written onto
        // the document, so a typo in admin cannot produce an unstyled site.
        const next = isSiteTheme(v?.theme) ? v.theme : "default";
        setTheme(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "default") root.removeAttribute("data-xl-theme");
    else root.setAttribute("data-xl-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
}
