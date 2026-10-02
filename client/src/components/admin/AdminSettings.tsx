import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  BUSINESS_SETTING_FIELDS,
  businessSettingsService,
  type BusinessSettings,
} from "@/lib/businessSettingsService";
export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [retry, setRetry] = useState(0);
  const [original, setOriginal] = useState<BusinessSettings>({});
  const [settings, setSettings] = useState<BusinessSettings>({});
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    businessSettingsService
      .get()
      .then(values => {
        if (!cancelled) {
          setOriginal(values);
          setSettings(values);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(
            "Could not load business settings. Retry before editing."
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retry]);
  const dirty = BUSINESS_SETTING_FIELDS.some(
    ({ key }) => settings[key] != null && settings[key] !== original[key]
  );
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving || loading || loadError || !dirty) return;
    setSaving(true);
    setSaveError("");
    try {
      const saved = await businessSettingsService.saveChanges(
        original,
        settings
      );
      setOriginal(saved);
      setSettings(saved);
      toast.success("Business settings saved");
    } catch {
      setSaveError(
        "Could not verify saved business settings. Your edits remain here. Retry or reload to check the database."
      );
      toast.error("Business settings were not confirmed saved");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Business information records
        </p>
      </div>
      <p className="text-sm text-slate-500">
        This form saves business records. Storefront contact links use
        deployment configuration; homepage/footer copy is edited in Site
        Content. Saving here does not change those settings.
      </p>
      {loading ? (
        <p role="status">Loading business settings…</p>
      ) : loadError ? (
        <div
          role="alert"
          className="space-y-3 rounded-lg border border-red-200 p-4 text-red-700"
        >
          <p>{loadError}</p>
          <Button
            variant="outline"
            onClick={() => setRetry(value => value + 1)}
          >
            Retry loading
          </Button>
        </div>
      ) : (
        <form
          aria-label="Business settings"
          onSubmit={save}
          className="space-y-4"
        >
          <Card className="grid gap-5 p-4 sm:p-6 md:grid-cols-2">
            {BUSINESS_SETTING_FIELDS.map(field => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`business-${field.key}`}>{field.label}</Label>
                <Input
                  id={`business-${field.key}`}
                  type={field.type}
                  value={settings[field.key] ?? ""}
                  disabled={saving}
                  onChange={event => {
                    setSettings(current => ({
                      ...current,
                      [field.key]: event.target.value,
                    }));
                    setSaveError("");
                  }}
                />
              </div>
            ))}
          </Card>
          {saveError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 p-3 text-sm text-red-700"
            >
              {saveError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setRetry(value => value + 1)}
            >
              Reload saved settings
            </Button>
            <Button type="submit" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
