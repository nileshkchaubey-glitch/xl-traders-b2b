---
name: Admin panel design system
description: Visual design decisions for XL Traders admin panel — colors, layout, component patterns
---

## Primary color

Red — `oklch(0.505 0.225 27.325)` set in `client/src/index.css` for both `:root` and `.dark` themes. Also fixes `--ring` and `--chart-*` to red tones. All Shadcn primary buttons render red automatically.

## Layout

- Fixed dark sidebar: `bg-[#1a1d27]`, 220px wide, Shopify-style nav groups
- Top bar: white, breadcrumb + "View Store" link
- Content area: `bg-[#f4f6f9]`, `max-w-screen-xl mx-auto px-6 py-6`

## Page header pattern (consistent across all admin pages)

```jsx
<div className="flex items-center gap-3">
  <h1 className="text-2xl font-bold text-slate-900">{Title}</h1>
  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
    {count}
  </span>
</div>
<p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
```

## Filter strip pattern

```jsx
<div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
  {/* search + selects */}
</div>
```

## Table card pattern (plain div, NOT Shadcn Card)

```jsx
<div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-sm min-w-[900px]">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50/80">
          <th className="... text-[11px] uppercase tracking-widest text-slate-500">…</th>
```

## Status badge pattern

```jsx
<button
  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
>
  <span
    className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
  />
  {active ? "Active" : "Inactive"}
</button>
```

## "Add X" button pattern

```jsx
<Button
  size="sm"
  className="gap-1.5 text-sm bg-red-600 hover:bg-red-700 text-white border-0"
>
  <Plus className="w-3.5 h-3.5" /> Add Product
</Button>
```

**Why:** User said old design was "very bad" — horizontal tabs, blue buttons, flat cards. Replaced with Shopify/Zoho-inspired premium aesthetic.
