import { useEffect, useState } from "react";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

/**
 * The owner-confirmed per-product dispatch line, from the admin-editable
 * `dispatch` site_content key.
 *
 * Seeded from FALLBACKS so the first paint carries the correct wording rather
 * than an empty gap, then overridden from the DB. settingsService caches the
 * whole table for the session, so mounting this on every card costs one fetch
 * per page, not one per card.
 */
export function useDispatchLine(): string {
  const [line, setLine] = useState(FALLBACKS.dispatch.line);

  useEffect(() => {
    settingsService
      .getContent("dispatch")
      .then(d => setLine(d.line))
      .catch(() => {});
  }, []);

  return line;
}
