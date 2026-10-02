import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  promoBannerService,
  type AdminPromoBanner,
  type BannerInput,
  type BannerPosition,
} from "@/lib/promoBannerService";

const EMPTY: BannerInput = {
  headline: "",
  image_url: null,
  rate_line: null,
  link_target: null,
  position: "home_top",
  sort_order: 0,
  is_active: false,
  starts_at: null,
  ends_at: null,
};
function localDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function AdminPromoBanners() {
  const [banners, setBanners] = useState<AdminPromoBanner[] | null>(null);
  const [form, setForm] = useState<BannerInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function load() {
    setError("");
    try {
      setBanners(await promoBannerService.listForAdmin());
    } catch {
      setError("Could not load banners. Check admin access and retry.");
    }
  }
  useEffect(() => {
    load();
  }, []);
  function patch<K extends keyof BannerInput>(key: K, value: BannerInput[K]) {
    setForm(previous => (previous ? { ...previous, [key]: value } : previous));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError("");
    try {
      const saved = editingId
        ? await promoBannerService.update(editingId, form)
        : await promoBannerService.create(form);
      setBanners(previous =>
        [...(previous ?? []).filter(row => row.id !== saved.id), saved].sort(
          (a, b) => a.sort_order - b.sort_order
        )
      );
      setForm(null);
      setEditingId(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save banner. Check admin access."
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Card className="p-6 space-y-4" aria-label="Promo banners">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Promo banners</h3>
          <p className="text-sm text-muted-foreground">
            Empty storefront slots stay hidden. New banners start inactive.
          </p>
        </div>
        <Button
          variant="outline"
          disabled={banners == null || saving}
          onClick={() => {
            setForm({ ...EMPTY });
            setEditingId(null);
            setError("");
          }}
        >
          Add banner
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {banners == null ? (
        error ? (
          <Button variant="outline" onClick={load}>
            Retry banners
          </Button>
        ) : (
          <p>Loading banners…</p>
        )
      ) : banners.length === 0 ? (
        <p className="text-sm text-muted-foreground">No banners configured.</p>
      ) : (
        <ul className="space-y-2">
          {banners.map(banner => (
            <li
              key={banner.id}
              className="flex items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{banner.headline}</p>
                <p className="text-xs text-muted-foreground">
                  {banner.position} ·{" "}
                  {banner.is_active ? "Enabled (schedule applies)" : "Inactive"}{" "}
                  · order {banner.sort_order}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                aria-label={`Edit ${banner.headline}`}
                onClick={() => {
                  setEditingId(banner.id);
                  setForm({
                    ...banner,
                    starts_at: localDate(banner.starts_at),
                    ends_at: localDate(banner.ends_at),
                  });
                  setError("");
                }}
              >
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      {form && (
        <form
          onSubmit={save}
          className="space-y-4 rounded-lg border p-4"
          aria-label="Banner editor"
        >
          <div className="space-y-1">
            <Label htmlFor="banner-headline">Headline</Label>
            <Input
              id="banner-headline"
              autoFocus
              required
              value={form.headline}
              onChange={event => patch("headline", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-text">Public supporting text</Label>
            <Input
              id="banner-text"
              value={form.rate_line ?? ""}
              onChange={event => patch("rate_line", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use verified public copy. Do not include protected product rates
              or unconfirmed delivery/freight promises.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-image">Image URL (optional)</Label>
            <Input
              id="banner-image"
              value={form.image_url ?? ""}
              onChange={event => patch("image_url", event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use an existing Image Library URL or a same-site image path.
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="banner-link">Link (optional)</Label>
            <Input
              id="banner-link"
              value={form.link_target ?? ""}
              onChange={event => patch("link_target", event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="banner-position">Position</Label>
              <select
                id="banner-position"
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                value={form.position}
                onChange={event =>
                  patch("position", event.target.value as BannerPosition)
                }
              >
                <option value="home_top">Home top</option>
                <option value="home_mid">Home middle</option>
                <option value="category_top">Category pages (shared)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-order">Sort order</Label>
              <Input
                id="banner-order"
                type="number"
                min={0}
                step={1}
                required
                value={form.sort_order}
                onChange={event =>
                  patch("sort_order", Number(event.target.value))
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-start">
                Starts (local time, optional)
              </Label>
              <Input
                id="banner-start"
                type="datetime-local"
                value={form.starts_at ?? ""}
                onChange={event =>
                  patch("starts_at", event.target.value || null)
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="banner-end">Ends (local time, optional)</Label>
              <Input
                id="banner-end"
                type="datetime-local"
                value={form.ends_at ?? ""}
                onChange={event => patch("ends_at", event.target.value || null)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="banner-active"
              checked={form.is_active}
              disabled={!editingId}
              onCheckedChange={value => patch("is_active", value)}
            />
            <Label htmlFor="banner-active">Active</Label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving
                ? "Saving…"
                : editingId
                  ? "Save banner"
                  : "Create inactive banner"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setForm(null);
                setEditingId(null);
                setError("");
              }}
            >
              Cancel banner
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
