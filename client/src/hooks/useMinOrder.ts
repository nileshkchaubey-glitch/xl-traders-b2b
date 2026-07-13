import { useEffect, useState } from "react";
import { settingsService, FALLBACKS } from "@/lib/settingsService";

export interface MinOrderSettings {
  enabled: boolean;
  value: number;
}

/**
 * Reads the admin-managed minimum-order-value setting (site_content:
 * min_order_enabled / min_order_value). Defaults OFF via FALLBACKS so an
 * empty table changes nothing on the live site.
 */
export function useMinOrder(): MinOrderSettings {
  const [settings, setSettings] = useState<MinOrderSettings>({
    enabled: FALLBACKS.min_order_enabled,
    value: FALLBACKS.min_order_value,
  });

  useEffect(() => {
    Promise.all([
      settingsService.getContent("min_order_enabled"),
      settingsService.getContent("min_order_value"),
    ])
      .then(([enabled, value]) => setSettings({ enabled, value }))
      .catch(() => {});
  }, []);

  return settings;
}
