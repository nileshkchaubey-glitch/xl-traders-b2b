import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

/**
 * The storefront page title bar — one component, two measured layouts.
 *
 * Read off the rendered prototype (STOREFRONT_RULES §6.1) on the Catalogue and
 * Cart screens, which use the same bar:
 *
 *   mobile 390   a full-bleed row under a hairline —
 *                `←` back · title over sub · an actions slot pushed right
 *   desktop 1440 no back arrow; title and sub share ONE baseline, actions right
 *
 * It exists as a component rather than as JSX in two pages because the two had
 * already drifted: the catalogue shipped this bar in #178 while the cart still
 * rendered a 24px `<h1>` with the item count **inside** it, so a screen reader
 * announced "Your Cart1 item · 3,360 quantities" as the page heading. The
 * count is a `<p>` here, never part of the heading.
 *
 * TYPE — one role, one value, per the #170 rule that a role carrying two near
 * values picks one rather than minting a token to preserve the difference:
 *
 *   title   prototype is 15px on the catalogue and 16px on the cart → one
 *           `text-page-title` (15). Desktop is 24 on both, which is stock
 *           `text-2xl`; `--text-page-title-lg` is 22, so the lg step uses the
 *           stock utility and the 2px gap is recorded, not smoothed away.
 *   sub     prototype is 10/500 slate-400 (catalogue) and 11/600 slate-500
 *           (cart) → one `text-meta-lg` (9.5) / `lg:text-product-name-lg`
 *           (12.5). Recorded near-misses, all ≤1px.
 *
 * The back arrow falls through to Home when there is no history, so opening a
 * page from a link or the bottom nav never leaves a dead control.
 */
export default function PageTitleBar({
  title,
  sub,
  actions,
  backLabel = "Go back",
}: {
  title: string;
  /** Rendered as a sibling of the heading, never inside it. */
  sub?: ReactNode;
  /** Right-hand slot: a filter pill, a toolbar, a "Continue shopping" link. */
  actions?: ReactNode;
  backLabel?: string;
}) {
  const [, setLocation] = useLocation();

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation("/");
  };

  return (
    <div className="-mx-4 mb-3.5 flex items-center gap-2.5 border-b border-slate-100 px-4 pb-2.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-5 lg:flex-wrap lg:items-end lg:justify-between lg:gap-4 lg:border-b-0 lg:px-0 lg:pb-0">
      <button
        type="button"
        onClick={goBack}
        aria-label={backLabel}
        className="-ml-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-slate-900 transition-colors hover:bg-slate-100 lg:hidden"
      >
        <ArrowLeft size={19} />
      </button>

      <div className="min-w-0 flex-1 lg:flex lg:flex-none lg:flex-wrap lg:items-baseline lg:gap-x-3 lg:gap-y-1">
        <h1 className="truncate text-page-title font-extrabold tracking-tight text-slate-900 lg:text-2xl">
          {title}
        </h1>
        {sub && (
          <p className="truncate text-meta-lg font-medium text-slate-400 lg:text-product-name-lg lg:text-slate-500">
            {sub}
          </p>
        )}
      </div>

      {actions}
    </div>
  );
}
