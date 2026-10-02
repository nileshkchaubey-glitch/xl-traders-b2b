import { supabase } from "./supabase";
export const BUSINESS_SETTING_FIELDS = [
  { key: "company_name", label: "Company name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "whatsapp", label: "WhatsApp number", type: "tel" },
  { key: "tagline", label: "Tagline", type: "text" },
  { key: "working_hours", label: "Working hours", type: "text" },
] as const;
export type BusinessSettingKey =
  (typeof BUSINESS_SETTING_FIELDS)[number]["key"];
export type BusinessSettings = Partial<Record<BusinessSettingKey, string>>;
const keys: readonly string[] = BUSINESS_SETTING_FIELDS.map(field => field.key);
function decode(rows: { key: string; value: unknown }[]): BusinessSettings {
  const values: BusinessSettings = {};
  for (const row of rows) {
    if (!keys.includes(row.key)) continue;
    if (row.value != null && typeof row.value !== "string")
      throw new Error("Invalid business setting value");
    values[row.key as BusinessSettingKey] = row.value ?? "";
  }
  return values;
}
export const businessSettingsService = {
  async get(): Promise<BusinessSettings> {
    const { data, error } = await supabase
      .from("business_settings")
      .select("key,value")
      .in("key", [...keys]);
    if (error) throw error;
    return decode(data ?? []);
  },
  async saveChanges(
    before: BusinessSettings,
    next: BusinessSettings
  ): Promise<BusinessSettings> {
    for (const key of Object.keys(next))
      if (!keys.includes(key)) throw new Error("Unsupported business setting");
    const changed = BUSINESS_SETTING_FIELDS.filter(
      ({ key }) => next[key] != null && next[key] !== before[key]
    );
    if (!changed.length) return before;
    const updated_at = new Date().toISOString();
    const payload = changed.map(({ key }) => {
      const value = next[key];
      if (typeof value !== "string")
        throw new Error("Business setting must be text");
      return { key, value, updated_at };
    });
    const { data, error } = await supabase
      .from("business_settings")
      .upsert(payload, { onConflict: "key" })
      .select("key,value");
    if (error) throw error;
    if (
      !data ||
      data.length !== payload.length ||
      payload.some(
        row =>
          !data.some(
            saved => saved.key === row.key && saved.value === row.value
          )
      )
    )
      throw new Error(
        "Could not verify saved settings. Reload before trying again."
      );
    return { ...before, ...decode(data) };
  },
};
