import type { RefObject } from "react";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";

import type { CatalogSelection } from "@/lib/catalogQuery";
import type { CategoryGroup, PublicProductSort } from "@/lib/productService";
import type { Category } from "@/lib/supabase";

import { chipClass } from "./chip";
import type { CatalogView } from "./CatalogToolbar";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The control that opens this sheet. Focus returns here on close — see the
   *  note on `onCloseAutoFocus` below. */
  triggerRef: RefObject<HTMLButtonElement | null>;
  selection: CatalogSelection;
  categories: Category[];
  groups: CategoryGroup[];
  brands: string[];
  canSortByPrice: boolean;
  view: CatalogView;
  onViewChange: (view: CatalogView) => void;
  onSortChange: (sort: PublicProductSort) => void;
  onCategoryChange: (slug: string | null) => void;
  onBrandChange: (brand: string | null) => void;
  onClearAll: () => void;
  totalCount: number;
}

function Section({ title }: { title: string }) {
  return (
    <div className="mb-2.5 text-caption font-bold uppercase tracking-widest text-slate-400">
      {title}
    </div>
  );
}

/**
 * Mobile filter & sort sheet.
 *
 * Built on the `vaul` Drawer rather than the hand-rolled overlay it replaces.
 * That overlay had none of the four things a modal owes a keyboard or screen
 * reader user: no `role="dialog"`, no focus trap, no Escape handler, and no
 * body scroll lock — the page scrolled behind it, and Tab walked straight out
 * of the sheet into the catalogue underneath while the sheet stayed open.
 *
 * The primitive supplies all four, plus swipe-to-close. It is also very nearly
 * free: `vaul`'s implementation was ALREADY in the storefront entry chunk on
 * `main` (measured — the chunk the HTML loads, not an admin chunk), so every
 * storefront visitor was downloading it regardless. Using it here costs about
 * +0.9 kB gzip. Hand-rolling a focus trap to dodge a cost we were already
 * paying would have been the worst of both.
 *
 * Why vaul is in the entry chunk is NOT established: only one lazy admin chunk
 * reaches `ui/drawer` (AdminDashboard -> AdminCategories -> MobileCategorySheet),
 * and there is no `manualChunks` config. An earlier draft of this comment
 * asserted "two lazy chunks share it"; a resolved-import graph disproved that.
 * The placement is measured, the reason is not — do not repeat a mechanism for
 * it without checking.
 *
 * `ui/drawer` is the same primitive every admin bottom sheet uses.
 */
export default function CatalogFilterSheet({
  open,
  onOpenChange,
  triggerRef,
  selection,
  categories,
  groups,
  brands,
  canSortByPrice,
  view,
  onViewChange,
  onSortChange,
  onCategoryChange,
  onBrandChange,
  onClearAll,
  totalCount,
}: Props) {
  const sorts: Array<[PublicProductSort, string]> = [
    ["newest", "Newest"],
    ["name", "Name A–Z"],
    ...(canSortByPrice
      ? ([
          ["price-low", "Price: Low"],
          ["price-high", "Price: High"],
        ] as Array<[PublicProductSort, string]>)
      : []),
  ];

  // Narrow to the selected group's categories when there is one, so the list is
  // the categories the customer is actually looking at.
  const categoryOptions =
    selection.group && groups.length > 0
      ? (groups.find(g => g.group_name === selection.group)?.categories ??
        categories)
      : categories;

  return (
    // `autoFocus` is REQUIRED for the focus trap to engage, and it is not the
    // default. vaul's Content does
    //     onOpenAutoFocus: e => { …; if (!autoFocus) e.preventDefault(); }
    // and `Root` defaults `autoFocus = false`, so focus stays on the trigger —
    // OUTSIDE Radix's FocusScope. The scope's sentinel guards only wrap focus
    // that is already inside it, so Tab walked straight through the chips
    // behind the open sheet. Measured before adding this: six Tab presses, six
    // landings outside the dialog. `role="dialog"` was present the whole time,
    // which is exactly why checking the markup would not have caught it.
    <Drawer open={open} onOpenChange={onOpenChange} autoFocus>
      <DrawerContent
        // The base sets `data-[vaul-drawer-direction=bottom]:max-h-[80vh]`.
        // A bare `max-h-[85vh]` LOSES to it — an attribute-qualified
        // selector is (0,2,0) against (0,1,0) — so the class applied but
        // did nothing (measured: max-height 649.9px on an 812px viewport,
        // exactly 80vh). Matching the variant lets tailwind-merge dedupe.
        className="rounded-t-[20px] data-[vaul-drawer-direction=bottom]:max-h-[85vh]"
        // The focus trap covers Tab; a screen reader in BROWSE mode does not
        // follow focus. Measured with the sheet open on this build: `#root`
        // carried NO `aria-hidden` and the content no `aria-modal`, so the
        // catalogue behind was still readable. `aria-modal="true"` is the
        // signal that confines browse mode to this subtree.
        //
        // Reading Radix's source suggests `hideOthers()` should have marked
        // `#root` here, so this attribute ought to be redundant. It is not:
        // re-measured live and `#root` is still unhidden. Trust the
        // measurement over the read; this line is doing real work.
        aria-modal="true"
        // Radix restores focus to `Dialog.Trigger` on close. This sheet is
        // CONTROLLED — the button lives in the catalogue toolbar, not in a
        // DrawerTrigger — so there is nothing for Radix to restore to and
        // focus fell to <body>. Measured: after Escape, activeElement was
        // BODY, meaning a keyboard user lost their place and had to Tab from
        // the top of the document. Restore it explicitly instead.
        onCloseAutoFocus={e => {
          const el = triggerRef.current;
          if (!el?.isConnected) return; // let Radix do whatever it would
          e.preventDefault();
          el.focus();
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-2.5 pt-2">
          <DrawerTitle className="text-body-md font-extrabold text-slate-900">
            Filters &amp; Sort
          </DrawerTitle>
          {/* Radix announces the dialog by title + description; without a
              description it logs a missing-aria-describedby warning. This is
              the description, read only by assistive tech. */}
          <DrawerDescription className="sr-only">
            Filter and sort the product catalogue.
          </DrawerDescription>
          <button
            onClick={onClearAll}
            className="text-body-sm font-bold text-red-600"
          >
            Clear all
          </button>
        </div>

        {/* The scroller. DrawerContent is a flex column, so this takes the
            remaining height and the footer below stays put. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <Section title="Sort" />
          <div className="mb-5 flex flex-wrap gap-2">
            {sorts.map(([value, label]) => (
              <button
                key={value}
                onClick={() => onSortChange(value)}
                aria-pressed={selection.sort === value}
                className={chipClass(selection.sort === value)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Was desktop-only. The duplicate mobile control bar that used to
              carry it is gone, so it lives here rather than being dropped. */}
          <Section title="View" />
          <div className="mb-5 flex flex-wrap gap-2">
            {(
              [
                ["grid", "Grid"],
                ["list", "List"],
              ] as Array<[CatalogView, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => onViewChange(value)}
                aria-pressed={view === value}
                className={chipClass(view === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <Section title="Category" />
          <div className="mb-5 flex flex-wrap gap-2">
            {categoryOptions.map(cat => (
              <button
                key={cat.id}
                onClick={() =>
                  onCategoryChange(
                    selection.category === cat.slug ? null : cat.slug
                  )
                }
                aria-pressed={selection.category === cat.slug}
                className={chipClass(selection.category === cat.slug)}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {brands.length > 0 && (
            <>
              <Section title="Brand" />
              <div className="flex flex-wrap gap-2">
                {brands.map(brand => (
                  <button
                    key={brand}
                    onClick={() =>
                      onBrandChange(selection.brand === brand ? null : brand)
                    }
                    aria-pressed={selection.brand === brand}
                    className={chipClass(selection.brand === brand)}
                  >
                    {brand}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-white px-5 py-3">
          <DrawerClose asChild>
            <button className="h-[50px] w-full rounded-xl bg-red-600 text-body-md font-extrabold text-white transition hover:bg-red-700">
              Show {totalCount.toLocaleString()} products
            </button>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
