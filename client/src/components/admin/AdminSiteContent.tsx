import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  settingsService,
  SiteContentMap,
  SiteContentKey,
} from "@/lib/settingsService";

// ─── Small reusable editors ──────────────────────────────────────────────────

function StringList({
  items,
  onChange,
  placeholder,
  addLabel,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((val, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={val}
            placeholder={placeholder}
            onChange={e => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4 text-slate-400" />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ""])}
        className="gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

function ObjectList<T>({
  items,
  fields,
  onChange,
  addLabel,
}: {
  // Every listed field is a string-valued property of T.
  items: T[];
  fields: { key: keyof T; label: string; textarea?: boolean }[];
  onChange: (next: T[]) => void;
  addLabel: string;
}) {
  const blank = () => fields.reduce((o, f) => ({ ...o, [f.key]: "" }), {}) as T;
  const setField = (i: number, key: keyof T, value: string) => {
    const next = [...items];
    next[i] = { ...items[i], [key]: value } as T;
    onChange(next);
  };
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={i}
          className="relative rounded-lg border border-slate-200 p-3 pr-10 space-y-2"
        >
          {fields.map(f => (
            <div key={String(f.key)} className="space-y-1">
              <Label className="text-xs text-slate-500">{f.label}</Label>
              {f.textarea ? (
                <Textarea
                  value={String(item[f.key] ?? "")}
                  rows={2}
                  onChange={e => setField(i, f.key, e.target.value)}
                />
              ) : (
                <Input
                  value={String(item[f.key] ?? "")}
                  onChange={e => setField(i, f.key, e.target.value)}
                />
              )}
            </div>
          ))}
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-600 transition"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, blank()])}
        className="gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

function SectionCard({
  title,
  description,
  onSave,
  saving,
  children,
}: {
  title: string;
  description?: string;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
        <Button
          onClick={onSave}
          disabled={saving}
          size="sm"
          className="gap-1.5 flex-shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-slate-500">{label}</Label>
      {children}
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 pt-2">
      {children}
    </h2>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminSiteContent() {
  const [content, setContent] = useState<SiteContentMap | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    settingsService
      .getAllContent()
      .then(setContent)
      .catch(() => toast.error("Couldn't load site content"));
  }, []);

  // Update one key in local state.
  function patch<K extends SiteContentKey>(key: K, value: SiteContentMap[K]) {
    setContent(prev => (prev ? { ...prev, [key]: value } : prev));
  }

  // Persist one key.
  async function save<K extends SiteContentKey>(key: K, label: string) {
    if (!content) return;
    setSaving(key);
    try {
      await settingsService.updateContent(key, content[key]);
      toast.success(`${label} saved`);
    } catch {
      toast.error(`Couldn't save ${label} — make sure you're signed in.`);
    } finally {
      setSaving(null);
    }
  }

  // Tax / GST saves two keys together.
  async function saveGst() {
    if (!content) return;
    setSaving("gst");
    try {
      await settingsService.updateContent("gst_enabled", content.gst_enabled);
      await settingsService.updateContent(
        "gst_percentage",
        content.gst_percentage
      );
      toast.success("Tax / GST saved");
    } catch {
      toast.error("Couldn't save Tax / GST — make sure you're signed in.");
    } finally {
      setSaving(null);
    }
  }

  // Retail / Ordering saves two keys together, same pattern as Tax / GST.
  async function saveMinOrder() {
    if (!content) return;
    setSaving("min_order");
    try {
      await settingsService.updateContent(
        "min_order_enabled",
        content.min_order_enabled
      );
      await settingsService.updateContent(
        "min_order_value",
        content.min_order_value
      );
      toast.success("Retail / Ordering saved");
    } catch {
      toast.error(
        "Couldn't save Retail / Ordering — make sure you're signed in."
      );
    } finally {
      setSaving(null);
    }
  }

  if (!content) {
    return <div className="text-center py-8 text-slate-500">Loading…</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site Content</h1>
        <p className="text-slate-400 text-xs mt-0.5">
          Edit storefront copy without a code deploy. Blank fields fall back to
          the built-in defaults.
        </p>
      </div>

      {/* ── HERO ── */}
      <GroupHeading>Hero</GroupHeading>
      <SectionCard
        title="Hero headline & delivery promise"
        description="The delivery promise is the largest text on the site — it leads the hero, above the headline."
        onSave={() => save("hero", "Hero")}
        saving={saving === "hero"}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Delivery promise (start)">
            <Input
              value={content.hero.promiseLead}
              onChange={e =>
                patch("hero", { ...content.hero, promiseLead: e.target.value })
              }
            />
          </Field>
          <Field label="Delivery promise (accent, shown red)">
            <Input
              value={content.hero.promiseAccent}
              onChange={e =>
                patch("hero", {
                  ...content.hero,
                  promiseAccent: e.target.value,
                })
              }
            />
          </Field>
        </div>
        <Field label="Delivery tiers">
          <StringList
            items={content.hero.promiseTiers}
            onChange={promiseTiers =>
              patch("hero", { ...content.hero, promiseTiers })
            }
            placeholder="e.g. Next-day · South Gujarat"
            addLabel="Add tier"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Headline (start)">
            <Input
              value={content.hero.titleLead}
              onChange={e =>
                patch("hero", { ...content.hero, titleLead: e.target.value })
              }
            />
          </Field>
          <Field label="Headline (accent, shown red)">
            <Input
              value={content.hero.titleAccent}
              onChange={e =>
                patch("hero", { ...content.hero, titleAccent: e.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Sub-text">
          <Textarea
            value={content.hero.subline}
            rows={3}
            onChange={e =>
              patch("hero", { ...content.hero, subline: e.target.value })
            }
          />
        </Field>
      </SectionCard>

      {/* ── TRUST ── */}
      <GroupHeading>Trust</GroupHeading>
      <SectionCard
        title="Trust stats"
        description='The four stat tiles ("Built For Repeat Wholesale Buying").'
        onSave={() => save("trust_stats", "Trust stats")}
        saving={saving === "trust_stats"}
      >
        <ObjectList
          items={content.trust_stats}
          fields={[
            { key: "value", label: "Value" },
            { key: "label", label: "Label" },
            { key: "sub", label: "Sub-text" },
          ]}
          onChange={v => patch("trust_stats", v)}
          addLabel="Add stat"
        />
      </SectionCard>

      <SectionCard
        title="Trust points"
        description="The three reasons-to-buy cards."
        onSave={() => save("trust_points", "Trust points")}
        saving={saving === "trust_points"}
      >
        <ObjectList
          items={content.trust_points}
          fields={[
            { key: "glyph", label: "Icon glyph (e.g. GST, ₹, ✓)" },
            { key: "title", label: "Title" },
            { key: "body", label: "Body", textarea: true },
          ]}
          onChange={v => patch("trust_points", v)}
          addLabel="Add point"
        />
      </SectionCard>

      {/* ── SERVICE AREAS ── */}
      <GroupHeading>Service Areas</GroupHeading>
      <SectionCard
        title="Service-area chips"
        description="Areas shown as pills in the Service Areas card."
        onSave={() => save("service_areas", "Service areas")}
        saving={saving === "service_areas"}
      >
        <StringList
          items={content.service_areas}
          onChange={v => patch("service_areas", v)}
          placeholder="e.g. Surat City"
          addLabel="Add area"
        />
      </SectionCard>

      {/* ── FAQ ── */}
      <GroupHeading>FAQ</GroupHeading>
      <SectionCard
        title="Common questions"
        description="The FAQ accordion near the bottom of the home page."
        onSave={() => save("faqs", "FAQs")}
        saving={saving === "faqs"}
      >
        <ObjectList
          items={content.faqs}
          fields={[
            { key: "q", label: "Question" },
            { key: "a", label: "Answer", textarea: true },
          ]}
          onChange={v => patch("faqs", v)}
          addLabel="Add question"
        />
      </SectionCard>

      {/* ── BULK BANNER ── */}
      <GroupHeading>Bulk banner</GroupHeading>
      <SectionCard
        title="Bulk & custom orders banner"
        description="The dark call-to-action banner mid-page."
        onSave={() => save("bulk_banner", "Bulk banner")}
        saving={saving === "bulk_banner"}
      >
        <Field label="Eyebrow">
          <Input
            value={content.bulk_banner.eyebrow}
            onChange={e =>
              patch("bulk_banner", {
                ...content.bulk_banner,
                eyebrow: e.target.value,
              })
            }
          />
        </Field>
        <Field label="Title">
          <Input
            value={content.bulk_banner.title}
            onChange={e =>
              patch("bulk_banner", {
                ...content.bulk_banner,
                title: e.target.value,
              })
            }
          />
        </Field>
        <Field label="Body">
          <Textarea
            value={content.bulk_banner.body}
            rows={2}
            onChange={e =>
              patch("bulk_banner", {
                ...content.bulk_banner,
                body: e.target.value,
              })
            }
          />
        </Field>
      </SectionCard>

      {/* ── ANNOUNCEMENT ── */}
      <GroupHeading>Announcement bar</GroupHeading>
      <SectionCard
        title="Top utility bar"
        description="The dark strip at the very top (desktop) and the mobile pill."
        onSave={() => save("announcement", "Announcement bar")}
        saving={saving === "announcement"}
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="GST line">
            <Input
              value={content.announcement.gstLine}
              onChange={e =>
                patch("announcement", {
                  ...content.announcement,
                  gstLine: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Delivery line">
            <Input
              value={content.announcement.deliveryLine}
              onChange={e =>
                patch("announcement", {
                  ...content.announcement,
                  deliveryLine: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Hours">
            <Input
              value={content.announcement.hours}
              onChange={e =>
                patch("announcement", {
                  ...content.announcement,
                  hours: e.target.value,
                })
              }
            />
          </Field>
          <Field label="Mobile pill">
            <Input
              value={content.announcement.mobilePill}
              onChange={e =>
                patch("announcement", {
                  ...content.announcement,
                  mobilePill: e.target.value,
                })
              }
            />
          </Field>
        </div>
      </SectionCard>

      {/* ── FOOTER ── */}
      <GroupHeading>Footer</GroupHeading>
      <SectionCard
        title="Footer"
        description="Brand blurb, address, ordering bullets and the tagline. (Category links come from your catalogue groups.)"
        onSave={() => save("footer", "Footer")}
        saving={saving === "footer"}
      >
        <Field label="Description">
          <Textarea
            value={content.footer.description}
            rows={2}
            onChange={e =>
              patch("footer", {
                ...content.footer,
                description: e.target.value,
              })
            }
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Address">
            <Input
              value={content.footer.address}
              onChange={e =>
                patch("footer", { ...content.footer, address: e.target.value })
              }
            />
          </Field>
          <Field label="Tagline (bottom bar)">
            <Input
              value={content.footer.tagline}
              onChange={e =>
                patch("footer", { ...content.footer, tagline: e.target.value })
              }
            />
          </Field>
        </div>
        <Field label="Ordering bullets">
          <StringList
            items={content.footer.ordering}
            onChange={ordering =>
              patch("footer", { ...content.footer, ordering })
            }
            placeholder="e.g. 24h dispatch pan-India"
            addLabel="Add bullet"
          />
        </Field>
      </SectionCard>

      {/* ── TAX / GST ── */}
      <GroupHeading>Tax / GST</GroupHeading>
      <SectionCard
        title="Tax / GST"
        description="Stored only for now — not yet applied to cart or checkout totals."
        onSave={saveGst}
        saving={saving === "gst"}
      >
        <div className="flex items-center gap-3">
          <Switch
            checked={content.gst_enabled}
            onCheckedChange={v => patch("gst_enabled", v)}
          />
          <Label className="text-sm text-slate-700">
            Enable GST on invoices
          </Label>
        </div>
        <Field label="GST percentage">
          <Input
            type="number"
            min={0}
            max={100}
            className="max-w-[160px]"
            value={String(content.gst_percentage)}
            onChange={e => patch("gst_percentage", Number(e.target.value) || 0)}
          />
        </Field>
      </SectionCard>

      {/* ── RETAIL / ORDERING ── */}
      <GroupHeading>Retail / Ordering</GroupHeading>
      <SectionCard
        title="Minimum order value"
        description="When enabled, the storefront's floating cart bar shows progress toward this amount and the cart checkout is blocked until it's met. Off by default — nothing changes until you turn this on."
        onSave={saveMinOrder}
        saving={saving === "min_order"}
      >
        <div className="flex items-center gap-3">
          <Switch
            checked={content.min_order_enabled}
            onCheckedChange={v => patch("min_order_enabled", v)}
          />
          <Label className="text-sm text-slate-700">
            Enforce a minimum order value
          </Label>
        </div>
        <Field label="Minimum order value (₹)">
          <Input
            type="number"
            min={0}
            className="max-w-[160px]"
            value={String(content.min_order_value)}
            onChange={e =>
              patch("min_order_value", Math.max(0, Number(e.target.value) || 0))
            }
          />
        </Field>
      </SectionCard>
    </div>
  );
}
