import { type OrderSpec, pluralNoun } from "@/lib/orderingModel";

/**
 * The ordering rules for one product, stated in plain words from REAL fields:
 *
 *   1 box = 900 pcs
 *   Minimum order: 900 pcs
 *   Order in steps of 900 pcs
 *
 * Every number comes from the resolved OrderSpec, so a product whose columns
 * are unusable shows the pack-mode wording rather than an invented piece count.
 * The step line is omitted when a step is one pack, because "steps of one box"
 * tells the buyer nothing they can't see from the stepper.
 */
export default function OrderRule({ spec }: { spec: OrderSpec }) {
  const rows: [string, string][] = [];

  if (spec.packSize > 1) {
    rows.push([
      `1 ${spec.noun}`,
      `${spec.packSize.toLocaleString("en-IN")} pcs`,
    ]);
  }

  rows.push([
    "Minimum order",
    spec.unit === "pcs"
      ? `${spec.minPcs.toLocaleString("en-IN")} pcs`
      : `${spec.minPacks.toLocaleString("en-IN")} ${pluralNoun(spec.noun, spec.minPacks)}`,
  ]);

  if (spec.unit === "pcs" && spec.step !== spec.packSize) {
    rows.push([
      "Order in steps of",
      `${spec.step.toLocaleString("en-IN")} pcs`,
    ]);
  }

  return (
    <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/60">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-3.5 py-2">
          <dt className="text-body-sm text-slate-500">{k}</dt>
          <dd className="text-body-sm font-bold text-slate-900 tabular-nums">
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
