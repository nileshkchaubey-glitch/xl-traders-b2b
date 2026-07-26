import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ImageIcon,
  Upload,
  Library,
  Loader2,
  Star,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  Link2,
  Plus,
  Maximize2,
  GripVertical,
  MoreHorizontal,
  Rows3,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import CategoryCombobox from "@/components/admin/CategoryCombobox";
import AdminImageLibrary from "@/components/admin/AdminImageLibrary";
import { confirm } from "@/components/ui/confirm-dialog";
import { productToForm } from "@/lib/productForm";
import { useProductForm } from "@/hooks/useProductForm";
import { useSaveFeedback, toastWithUndo } from "@/hooks/useSaveFeedback";
import { validateEdit, isValidationError } from "@/lib/productValidation";
import {
  productService,
  productImageService,
  storageService,
  mediaService,
} from "@/lib/productService";
import { autoResizeImage, normalizeImageUrl } from "@/lib/imageUtils";
import { isPriceOnEnquiry } from "@/lib/priceUtils";
import { useIsMobile } from "@/hooks/useMobile";
import { Category, Product, ProductImage, ProductStatus } from "@/lib/supabase";

const UNITS = ["pcs", "box", "pack", "roll", "kg", "litre", "set"];

// ── Desktop pane geometry ─────────────────────────────────────────────────────
// The queue is fixed, the fields pane is user-resizable, and the image pane
// takes whatever is left. The two minimums below are what the drag is clamped
// against, so the image can never be squeezed to nothing and the fields pane
// can never fall back into the truncation that DE-08 was about.
// The taller rows carry a 44px thumbnail, a readiness icon and an overflow
// menu, so 240 left product names truncating after ~11 characters. 280 fixes
// that where there is room; on a narrow shell those 40px are worth more to the
// image than to the queue, so the queue gives them back.
const LIST_WIDE = 280;
const LIST_NARROW = 240;
const DIVIDER_W = 8;
const FIELDS_MIN = 340;
// Product photos are mostly landscape, so on a wide screen the image pane runs
// out of *useful* width long before it runs out of pane — past roughly 520px
// the extra pixels become margin either side of the picture, while the fields
// pane always spends them (fewer wrapped labels, a taller description box).
// On a narrow screen the opposite holds: the image is width-starved and every
// pixel it gives up costs real picture, so the fields pane takes the minimum.
const FIELDS_WIDE = 460;
const FIELDS_NARROW = 380;
/** Shell width below which the image pane is the one that needs the pixels. */
const NARROW_SHELL = 1250;
const IMAGE_MIN = 320;
/**
 * Narrowest shell that can hold all three panes at their minimums. Below this
 * the layout stacks instead of squeezing: at 150% zoom on a 1366 laptop the
 * shell has ~640px, and three-across left the image pane 37px wide — the
 * fields floor (340) simply wins the arithmetic against the image floor. A
 * stacked column is the honest answer at that size, and it is the layout the
 * component already has for mobile.
 */
const MIN_THREE_PANE = LIST_NARROW + DIVIDER_W + FIELDS_MIN + IMAGE_MIN;
/** Divider position lives in the URL — same no-localStorage rule as DataTable. */
const WIDTH_PARAM = "wbW";
/** Floor for the whole shell, so an absurdly short viewport still renders. */
const MIN_SHELL_H = 280;

/**
 * Shared field styling. The focus state is a real 2px ring rather than only a
 * border-colour shift — at a glance, mid-entry, a changed border is easy to
 * miss and the operator loses track of which field the keyboard is in.
 */
const FIELD_CLS =
  "h-11 text-sm mt-1 transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:border-red-400";

/**
 * Section label for the entry panes. A one-line description under each title
 * is what makes the grouping useful — "Pricing" alone is decoration, "Pricing /
 * what one selling unit costs" tells the operator which of the numbers in front
 * of them belongs here.
 */
function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex-shrink-0">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <p className="text-caption text-slate-400 mt-0.5">{hint}</p>
    </div>
  );
}

// Fields validated through the shared PR-A layer before a save is attempted.
// Order matters: it is the order the errors surface in.
const VALIDATED: Array<{
  field: Parameters<typeof validateEdit>[0];
  value: (f: WorkbenchForm) => string;
  optional?: boolean;
}> = [
  { field: "name", value: f => f.name },
  { field: "price", value: f => f.price, optional: true },
  { field: "quantity_in_unit", value: f => f.quantity_in_unit },
  { field: "moq", value: f => f.moq },
];

type WorkbenchForm = ReturnType<typeof useProductForm>["formData"];

interface CatalogWorkbenchProps {
  /** Products for the current tree node + toolbar filters (already server-filtered). */
  products: Product[];
  loading: boolean;
  categories: Category[];
  /** Total across all pages, for the progress indicator. */
  totalCount: number;
  /** 1-based index of the first row on this page, for the progress indicator. */
  pageOffset: number;
  /** Ids the health view considers incomplete — drives the list's amber dot. */
  incompleteIds: Set<string>;
  /** Patch a row in the parent's list after a save (keeps table + workbench in sync). */
  onProductSaved: (product: Product) => void;
  /** Ask the parent to refresh aggregates/chips after a save. */
  onAfterSave: () => void;
  /** Advance to the next page when Save & Next runs off the end of this one. */
  onRequestNextPage?: () => void;
  hasNextPage?: boolean;
  scopeTitle: string;
  /**
   * The Catalog Editor's row menu, passed down rather than rebuilt so the
   * queue's overflow menu is literally the table's menu — same items, same
   * handlers. Signature matches `<DataTable>`'s `rowContextMenu`.
   */
  rowMenuItems?: (
    p: Product,
    Item: typeof DropdownMenuItem,
    Separator: typeof DropdownMenuSeparator
  ) => React.ReactNode;
  /** Switch to Table mode focused on this product. */
  onOpenInTable?: (p: Product) => void;
}

export default function CatalogWorkbench({
  products,
  loading,
  categories,
  totalCount,
  pageOffset,
  incompleteIds,
  onProductSaved,
  onAfterSave,
  onRequestNextPage,
  hasNextPage,
  scopeTitle,
  rowMenuItems,
  onOpenInTable,
}: CatalogWorkbenchProps) {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { formData, updateForm, load, saving, save } = useProductForm(null);
  const { committingRef, isFlashing, flashSaved } = useSaveFeedback();

  const [gallery, setGallery] = useState<ProductImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  /** Index into `allImages` when the full-page lightbox is open; null = closed. */
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  /** Gallery slot the hidden file input is currently targeting (1 = primary). */
  /**
   * What the hidden gallery file input is currently aimed at. `replaceId` set
   * means overwrite THAT product_images row rather than appending a new one —
   * without it, "Replace" re-uploaded to the same storage key but still called
   * create(), leaving two rows pointing at one file.
   */
  const [uploadTarget, setUploadTarget] = useState<{
    slot: number;
    replaceId?: string;
  }>({ slot: 2 });
  // Mirrors committingRef for rendering — a ref can't drive the button state.
  const [committing, setCommitting] = useState(false);

  // "A file for this SKU already exists" prompt.
  const [skuMatches, setSkuMatches] = useState<{ name: string; url: string }[]>(
    []
  );
  const [skuPromptOpen, setSkuPromptOpen] = useState(false);
  const pendingFileRef = useRef<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  // Per-field refs so a refused save can put the cursor on the offending field
  // rather than only firing a toast the operator has to interpret.
  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const qtyInputRef = useRef<HTMLInputElement>(null);
  const moqInputRef = useRef<HTMLInputElement>(null);
  const fieldRefs: Record<
    string,
    React.RefObject<HTMLInputElement | null>
  > = useMemo(
    () => ({
      name: nameInputRef,
      price: priceInputRef,
      quantity_in_unit: qtyInputRef,
      moq: moqInputRef,
    }),
    []
  );

  // ── Viewport lock ──────────────────────────────────────────────────────────
  // There is deliberately no JS here. The shell asks for `flex-1 min-h-0` and
  // an unbroken flex-column chain above it does the rest:
  //
  //   AdminDashboard  h-dvh                     ← the one real height
  //     └ column      flex-1 flex flex-col min-h-0
  //        └ <main>   flex-1 min-h-0 overflow-y-auto
  //           └ wrap  min-h-full flex flex-col   (catalog-editor tab only)
  //              └ CatalogTreeEditor  flex-1 min-h-0   (workbench mode only)
  //                 └ panes row       flex-1 min-h-0
  //                    └ this shell   h-full
  //
  // The earlier version measured the space above and below itself and set an
  // explicit pixel height. That is correct exactly once: a computed height in
  // px doesn't re-derive on browser zoom or a DPI change, so at 90% or 110%
  // the shell kept its stale height and left a blank band below it. Layout
  // that has to survive zoom belongs in the layout engine.

  // ── Draggable image ┃ fields divider ───────────────────────────────────────
  const [, setLocation] = useLocation();
  // `null` = never dragged, so the width tracks the viewport-dependent default
  // below instead of being pinned to whatever suited the first screen it saw.
  const [fieldsWidth, setFieldsWidth] = useState<number | null>(() => {
    const raw = Number(
      new URLSearchParams(window.location.search).get(WIDTH_PARAM)
    );
    return Number.isFinite(raw) && raw >= FIELDS_MIN ? raw : null;
  });
  const [containerW, setContainerW] = useState(0);
  const widthRef = useRef(fieldsWidth ?? FIELDS_WIDE);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || isMobile) return;
    const ro = new ResizeObserver(([entry]) =>
      setContainerW(entry.contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  const narrowShell = !!containerW && containerW < NARROW_SHELL;
  const defaultFieldsWidth = narrowShell ? FIELDS_NARROW : FIELDS_WIDE;
  const listWidth = narrowShell ? LIST_NARROW : LIST_WIDE;
  // Clamp against the CURRENT container, not just the stored value: a width
  // dragged wide at 1920 must not push the image below its minimum at 1280.
  const maxFieldsWidth = containerW
    ? Math.max(FIELDS_MIN, containerW - listWidth - DIVIDER_W - IMAGE_MIN)
    : Number.POSITIVE_INFINITY;
  // Measured on the shell itself, so it reacts to the divider/sidebar/zoom
  // rather than to a viewport breakpoint that doesn't know about them.
  const stacked = isMobile || (containerW > 0 && containerW < MIN_THREE_PANE);
  const effFieldsWidth = Math.min(
    Math.max(fieldsWidth ?? defaultFieldsWidth, FIELDS_MIN),
    maxFieldsWidth
  );

  // Written on pointer-up only. A URL write per mouse-move would spam history
  // and re-render the whole editor mid-drag.
  const persistWidth = useCallback(
    (w: number) => {
      const params = new URLSearchParams(window.location.search);
      params.set(WIDTH_PARAM, String(Math.round(w)));
      setLocation(`${window.location.pathname}?${params.toString()}`, {
        replace: true,
      });
    },
    [setLocation]
  );

  const startDividerDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const el = shellRef.current;
      if (!el) return;
      const right = el.getBoundingClientRect().right;
      const onMove = (ev: PointerEvent) => {
        const w = right - ev.clientX;
        widthRef.current = w;
        setFieldsWidth(w);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        persistWidth(
          Math.min(
            Math.max(widthRef.current, FIELDS_MIN),
            containerW
              ? Math.max(
                  FIELDS_MIN,
                  containerW - listWidth - DIVIDER_W - IMAGE_MIN
                )
              : widthRef.current
          )
        );
      };
      // Without these the drag selects the text it passes over.
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [containerW, listWidth, persistWidth]
  );

  // Reset clears the override entirely rather than writing today's default in,
  // so the width goes back to tracking the viewport.
  const resetDivider = useCallback(() => {
    widthRef.current = defaultFieldsWidth;
    setFieldsWidth(null);
    const params = new URLSearchParams(window.location.search);
    params.delete(WIDTH_PARAM);
    setLocation(`${window.location.pathname}?${params.toString()}`, {
      replace: true,
    });
  }, [defaultFieldsWidth, setLocation]);

  const activeIndex = useMemo(
    () => products.findIndex(p => p.id === activeId),
    [products, activeId]
  );
  const active = activeIndex >= 0 ? products[activeIndex] : null;
  const busy = saving || committing;

  // Read inside the Undo callback, which outlives the render that created it —
  // a ref, not the state value, so it sees the CURRENT selection rather than
  // whatever was selected when the toast appeared.
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Monotonic save counter. Each Undo captures the revision it belongs to and
  // refuses to run once a newer save has happened.
  const revisionRef = useRef(0);

  // Select the first product whenever the queue changes underneath us (filter
  // change, page change) and the current selection is no longer in it.
  useEffect(() => {
    if (!products.length) {
      setActiveId(null);
      return;
    }
    if (!activeId || !products.some(p => p.id === activeId)) {
      setActiveId(products[0].id);
    }
  }, [products, activeId]);

  // Load the form + gallery for the selected product.
  useEffect(() => {
    if (!active) return;
    load(active);
    let cancelled = false;
    setGalleryLoading(true);
    productImageService
      .getByProductId(active.id)
      .then(rows => {
        if (!cancelled) setGallery(rows);
      })
      .catch(() => {
        if (!cancelled) setGallery([]);
      })
      .finally(() => {
        if (!cancelled) setGalleryLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `load` is stable (useCallback); re-running on the product id is the intent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id]);

  // Keep the selected row visible in the list pane when moving by keyboard.
  useEffect(() => {
    if (!activeId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-pid="${activeId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  const previewUrl = normalizeImageUrl(formData.image_url);

  // Primary first, then the gallery — the order the lightbox arrows walk.
  // Deduped because the primary is usually also a gallery row.
  const allImages = useMemo(() => {
    const out: { url: string; name: string }[] = [];
    const add = (raw?: string | null) => {
      if (!raw) return;
      const url = normalizeImageUrl(raw);
      if (!url || out.some(i => i.url === url)) return;
      const file = url.split("?")[0].split("/").pop() ?? "";
      let name = file;
      try {
        name = decodeURIComponent(file);
      } catch {
        // A malformed %-sequence in the path shouldn't break the caption.
      }
      out.push({ url, name: name || "image" });
    };
    add(formData.image_url);
    for (const g of gallery) add(g.image_url);
    return out;
  }, [formData.image_url, gallery]);

  const lightboxImage =
    lightboxIndex != null ? allImages[lightboxIndex] : undefined;

  // Arrow keys walk the gallery. Bound to the document because the lightbox
  // has no single focusable element to hang a handler on, and Radix already
  // owns Escape.
  useEffect(() => {
    if (lightboxIndex == null || allImages.length < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setLightboxIndex(i => {
        if (i == null) return i;
        const step = e.key === "ArrowRight" ? 1 : -1;
        return (i + step + allImages.length) % allImages.length;
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxIndex, allImages.length]);

  // Selecting a different product must not leave the lightbox showing the old
  // one, and a shrinking gallery must not leave the index past the end.
  useEffect(() => setLightboxIndex(null), [active?.id]);
  useEffect(() => {
    if (lightboxIndex != null && lightboxIndex >= allImages.length) {
      setLightboxIndex(allImages.length ? allImages.length - 1 : null);
    }
  }, [allImages.length, lightboxIndex]);

  // Live price readout. Three distinct states, because a half-typed or invalid
  // price must not render as "₹NaN/pc": blank → On Enquiry, unparseable →
  // say so, valid → show the derived per-piece rate.
  const priceRaw = formData.price.trim();
  const priceNum = priceRaw === "" ? null : Number(priceRaw);
  const priceInvalid = priceNum !== null && !Number.isFinite(priceNum);
  const onEnquiry =
    priceNum === null || (!priceInvalid && isPriceOnEnquiry(priceNum));
  const packQty = Number(formData.quantity_in_unit);
  const perPiece =
    !onEnquiry && !priceInvalid && Number.isFinite(packQty) && packQty > 1
      ? (priceNum as number) / packQty
      : null;

  // ── Validation via the shared PR-A layer ───────────────────────────────────
  // Runs before any network call so a refused value keeps focus for correction
  // instead of looking like it saved. Price is skipped when the product is
  // deliberately On Enquiry — validateEdit refuses blank by design (DE-01), and
  // that refusal must not block saving a genuinely price-less product.
  const fieldErrors = useMemo(() => {
    const out: Record<string, string> = {};
    for (const rule of VALIDATED) {
      const raw = rule.value(formData);
      if (rule.optional && raw.trim() === "") continue;
      const result = validateEdit(rule.field, raw);
      if (isValidationError(result)) out[rule.field] = result.error;
    }
    return out;
  }, [formData]);

  // Errors surface inline, next to the field — but only once the operator has
  // left the field or attempted a save. Flagging an empty Name the instant a
  // product loads would paint the pane red on every single row.
  const [touched, setTouched] = useState<Set<string>>(new Set());
  useEffect(() => {
    setTouched(new Set());
  }, [active?.id]);
  const markTouched = (field: string) =>
    setTouched(prev => (prev.has(field) ? prev : new Set(prev).add(field)));
  const shownError = (field: string) =>
    touched.has(field) ? fieldErrors[field] : undefined;
  const errorClass = (field: string) =>
    shownError(field) ? "border-red-400 focus-visible:ring-red-300" : "";
  const renderFieldError = (field: string) => {
    const message = shownError(field);
    if (!message) return null;
    return (
      <p className="text-caption text-red-600 mt-1 flex items-start gap-1">
        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
        <span>{message}</span>
      </p>
    );
  };

  // Unsaved-changes guard. The whole Workbench flow is "edit several fields,
  // then Save", so clicking another product in the queue — or the prev/next
  // chevrons — before saving would silently discard the edits. Compared against
  // the product's pristine form shape, the same way CatalogProductPanel does it.
  const dirty = useMemo(() => {
    if (!active) return false;
    return JSON.stringify(formData) !== JSON.stringify(productToForm(active));
  }, [formData, active]);

  const selectProduct = useCallback(
    async (id: string) => {
      if (id === activeId) return;
      if (
        dirty &&
        !(await confirm({
          title: "Discard unsaved changes?",
          description:
            "This product has edits that haven't been saved. Switching will lose them.",
          destructive: true,
          confirmLabel: "Discard",
        }))
      )
        return;
      setActiveId(id);
    },
    [activeId, dirty]
  );

  const goTo = useCallback(
    (index: number) => {
      if (index < 0 || index >= products.length) return;
      void selectProduct(products[index].id);
    },
    [products, selectProduct]
  );

  // ── Save ───────────────────────────────────────────────────────────────────
  const doSave = useCallback(
    async (advance: boolean) => {
      if (!active || committingRef.current) return;

      // Reveal every inline error at once and land the cursor on the first
      // offender, so the operator can fix it without hunting. The toast stays
      // as the "something happened" signal; the inline message says where.
      const badField = VALIDATED.map(r => r.field).find(f => fieldErrors[f]);
      if (badField) {
        setTouched(new Set(VALIDATED.map(r => r.field)));
        fieldRefs[badField]?.current?.focus();
        toast.error(fieldErrors[badField]);
        return;
      }

      const previous = active;
      committingRef.current = true;
      setCommitting(true);
      try {
        const saved = await save({ productId: active.id });
        if (!saved) return; // useProductForm already toasted
        onProductSaved(saved);
        flashSaved(saved.id);

        // Undo is scoped to THIS save of THIS product. Two guards:
        //  * A newer save for the same product supersedes this one, so an older
        //    toast can no longer roll the newer values back (sonner keeps up to
        //    3 toasts visible, so an older one is genuinely clickable).
        //  * `load()` only repopulates the form when the reverted product is
        //    still the selected one. Save & Next advances immediately, so
        //    without this the previous product's values would be loaded into
        //    the form while the NEXT product is selected — and the following
        //    save would write them onto the wrong product.
        const revision = ++revisionRef.current;
        toastWithUndo("Saved", async () => {
          if (revision !== revisionRef.current) {
            toast.info("Superseded by a newer save — nothing undone");
            return;
          }
          // Restore the exact pre-save row. `?? null` (not undefined) so a
          // field that was empty before is actively cleared again rather than
          // being omitted from the payload and left at the new value.
          const revertPatch: Record<string, unknown> = {
            name: previous.name,
            sku: previous.sku ?? null,
            price: previous.price ?? null,
            quantity_in_unit: previous.quantity_in_unit ?? null,
            moq: previous.moq ?? null,
            brand: previous.brand ?? null,
            category_id: previous.category_id,
            unit_of_measure: previous.unit_of_measure,
            description: previous.description ?? null,
            status: previous.status,
            image_url: previous.image_url ?? null,
          };
          const reverted = await productService.update(
            previous.id,
            revertPatch as Partial<Product>
          );
          onProductSaved(reverted);
          if (activeIdRef.current === reverted.id) load(reverted);
          onAfterSave();
        });
        onAfterSave();

        if (advance) {
          if (activeIndex < products.length - 1) {
            // setActiveId directly, NOT selectProduct: the edits were just
            // persisted, but `dirty` is computed from this render's `active`,
            // which the parent hasn't patched yet — so the guard would prompt
            // "discard unsaved changes?" immediately after a successful save.
            setActiveId(products[activeIndex + 1].id);
            // Land in the field the next product is most likely to need.
            setTimeout(() => nameInputRef.current?.focus(), 0);
          } else if (hasNextPage) onRequestNextPage?.();
          else toast.info("That was the last product in this view");
        }
      } finally {
        committingRef.current = false;
        setCommitting(false);
      }
    },
    [
      active,
      activeIndex,
      committingRef,
      fieldErrors,
      fieldRefs,
      flashSaved,
      hasNextPage,
      load,
      onAfterSave,
      onProductSaved,
      onRequestNextPage,
      products.length,
      save,
    ]
  );

  // ── Images ─────────────────────────────────────────────────────────────────
  // Setting the primary image persists immediately rather than waiting for
  // Save. In an image-first workflow the operator uploads a photo and then
  // clicks the next product in the queue; without this the upload would sit
  // only in form state and be silently dropped, leaving an orphaned file in the
  // bucket and the old image on the product. It is a targeted one-column patch,
  // so it cannot clobber whatever else is being typed.
  const setPrimaryImage = useCallback(
    async (url: string) => {
      updateForm("image_url", url);
      if (!active) return;
      try {
        const saved = await productService.update(active.id, {
          image_url: url,
        } as Partial<Product>);
        onProductSaved(saved);
        onAfterSave();
      } catch {
        toast.error("Image set locally but not saved — press Save");
      }
    },
    [active, onAfterSave, onProductSaved, updateForm]
  );

  const addToGallery = useCallback(
    async (url: string) => {
      if (!active) return;
      try {
        await productImageService.create({
          product_id: active.id,
          image_url: url,
          display_order: gallery.length,
        });
        setGallery(await productImageService.getByProductId(active.id));
        toast.success("Added to gallery");
      } catch {
        toast.error("Could not add image");
      }
    },
    [active, gallery.length]
  );

  const uploadFile = useCallback(
    async (file: File, slot: number, replaceId?: string) => {
      if (!active) return;
      const sku = formData.sku.trim();
      setUploading(true);
      try {
        const { file: resized } = await autoResizeImage(
          file,
          1600,
          0.85,
          "webp"
        );
        // With a SKU the file is named after it (XL0105.webp); without one we
        // fall back to the Image Library's random-name path.
        const url = sku
          ? await storageService.uploadBySku(resized, sku, slot)
          : await mediaService.uploadGlobalImage(resized);
        if (slot === 1) {
          await setPrimaryImage(url);
        } else if (replaceId) {
          const replaced = gallery.find(g => g.id === replaceId);
          await productImageService.update(replaceId, { image_url: url });
          setGallery(await productImageService.getByProductId(active.id));
          // uploadBySku cache-busts the URL, so a replaced image that was also
          // the primary would otherwise keep pointing at the stale one.
          if (
            replaced &&
            normalizeImageUrl(replaced.image_url) ===
              normalizeImageUrl(formData.image_url)
          ) {
            await setPrimaryImage(url);
          }
        } else {
          await addToGallery(url);
        }
        toast.success(sku ? `Uploaded as ${sku}` : "Uploaded");
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [
      active,
      addToGallery,
      formData.image_url,
      formData.sku,
      gallery,
      setPrimaryImage,
    ]
  );

  // Before uploading, check whether the bucket already holds a file for this
  // SKU — re-uploading would silently overwrite it (upsert:true), so offer to
  // attach the existing one instead.
  const handleFilePicked = useCallback(
    async (file: File) => {
      const sku = formData.sku.trim();
      if (!sku) {
        void uploadFile(file, 1);
        return;
      }
      try {
        const matches = await storageService.listBySku(sku);
        if (matches.length) {
          pendingFileRef.current = file;
          setSkuMatches(matches);
          setSkuPromptOpen(true);
          return;
        }
      } catch {
        // Listing is best-effort; fall through to a normal upload.
      }
      void uploadFile(file, 1);
    },
    [formData.sku, uploadFile]
  );

  const removeGalleryImage = async (id: string) => {
    if (!active) return;
    try {
      await productImageService.delete(id);
      setGallery(await productImageService.getByProductId(active.id));
    } catch {
      toast.error("Could not remove image");
    }
  };

  // ── Keyboard ───────────────────────────────────────────────────────────────
  // Tab moves between fields (native — every field is a real focusable input,
  // which is the thing the table could not offer). Enter from any single-line
  // field commits and advances, matching the table's Enter-to-commit muscle
  // memory and keeping the rebuild loop on the keyboard. The description
  // textarea keeps Enter for newlines, so it takes Ctrl/Cmd+Enter instead.
  const onFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    const isTextarea = (e.target as HTMLElement).tagName === "TEXTAREA";
    if (isTextarea && !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    void doSave(true);
  };

  // ── Panes ──────────────────────────────────────────────────────────────────
  const listPane = (
    <div
      className={
        stacked
          ? "w-full"
          : "flex-shrink-0 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden"
      }
      style={stacked ? undefined : { width: listWidth }}
    >
      <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <p className="text-xs font-semibold text-slate-700 truncate">
          {scopeTitle}
        </p>
        <p className="text-caption text-slate-400 mt-0.5">
          {activeIndex >= 0 ? pageOffset + activeIndex : 0} / {totalCount}
        </p>
      </div>
      <div
        ref={listRef}
        className={
          stacked
            ? "max-h-40 overflow-y-auto"
            : "flex-1 overflow-y-auto min-h-0"
        }
      >
        {loading ? (
          <div className="p-3 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-5 text-center">
            <p className="text-xs font-semibold text-slate-700">
              Nothing in this scope
            </p>
            <p className="text-caption text-slate-400 mt-1">
              {scopeTitle === "All Products"
                ? "No products match the current filters."
                : `“${scopeTitle}” has no products yet. Pick another scope above, or add one in Table mode.`}
            </p>
          </div>
        ) : (
          products.map((p, i) => {
            const isActive = p.id === activeId;
            return (
              // Row is a container, not a button: the overflow menu's trigger
              // is itself a button and cannot be nested inside one.
              <div
                key={p.id}
                data-pid={p.id}
                className={`group flex items-stretch border-b border-slate-100 border-l-[3px] transition-colors duration-150 ${
                  isActive
                    ? "bg-red-50 border-l-red-600"
                    : isFlashing(p.id)
                      ? "bg-emerald-50 border-l-emerald-400"
                      : "border-l-transparent hover:bg-slate-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void selectProduct(p.id)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex-1 min-w-0 text-left px-3 py-2.5 flex items-center gap-2.5 min-h-16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300"
                >
                  <span
                    className={`w-11 h-11 rounded-lg border overflow-hidden flex-shrink-0 flex items-center justify-center transition-colors duration-150 ${
                      isActive
                        ? "border-red-300 bg-white"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    {p.image_url ? (
                      <img
                        src={normalizeImageUrl(p.image_url)}
                        alt=""
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-300" />
                    )}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span
                      className={`block truncate text-sm leading-tight ${isActive ? "font-semibold text-red-700" : "font-medium text-slate-700"}`}
                    >
                      {p.name}
                    </span>
                    <span className="block truncate text-caption text-slate-400 mt-0.5">
                      {pageOffset + i} · {p.sku || "no SKU"}
                    </span>
                  </span>
                  {incompleteIds.has(p.id) ? (
                    <AlertCircle
                      className="w-4 h-4 text-amber-500 flex-shrink-0"
                      aria-label="Incomplete"
                    />
                  ) : (
                    <Check
                      className="w-4 h-4 text-emerald-500 flex-shrink-0"
                      aria-label="Complete"
                    />
                  )}
                </button>
                {(rowMenuItems || onOpenInTable) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        title="More actions"
                        aria-label={`Actions for ${p.name}`}
                        // Always rendered, never hover-gated: this component
                        // is the mobile products surface too, and
                        // `group-hover` never resolves without a pointer.
                        // w-11 = the 44px touch target the mobile admin uses.
                        className="w-11 flex-shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 data-[state=open]:text-slate-700 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-300"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {onOpenInTable && (
                        <>
                          <DropdownMenuItem
                            onClick={() => onOpenInTable(p)}
                            className="gap-2"
                          >
                            <Rows3 className="w-3.5 h-3.5" /> Open in Table
                          </DropdownMenuItem>
                          {rowMenuItems && <DropdownMenuSeparator />}
                        </>
                      )}
                      {rowMenuItems?.(
                        p,
                        DropdownMenuItem,
                        DropdownMenuSeparator
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const imagePane = (
    <div
      className={
        stacked
          ? "w-full p-3 border-b border-slate-200"
          : // Image is the FLEXIBLE pane: it absorbs whatever the fixed list
            // and the (resizable) fields pane don't need, rather than claiming
            // a fixed width and squeezing the fields into what's left (DE-08).
            // min-w-0 because the drag clamp, not flexbox, enforces IMAGE_MIN.
            "flex-1 min-w-0 p-4 flex flex-col gap-3 min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden"
      }
    >
      {/* THE large image. The bordered box is the IMAGE, not a fixed-size
          container the image floats inside: the button is a centring flex box
          with no chrome of its own, and the chrome (border, background,
          rounding) sits on the <img>, which is capped at 100% of the available
          box in both axes. A landscape photo in a tall pane therefore reads as
          a wide picture rather than a small picture marooned in a large empty
          rectangle. */}
      <SectionHeading
        title="Media"
        hint="Click the photo for a full-page view. Uploads are named after the SKU."
      />
      <button
        type="button"
        onClick={() => previewUrl && setLightboxIndex(0)}
        disabled={!previewUrl}
        title={previewUrl ? "Open full-page view" : undefined}
        className={`w-full ${stacked ? "aspect-square" : "flex-1 min-h-[200px]"} overflow-hidden flex items-center justify-center transition-[transform,box-shadow] duration-150 ${previewUrl ? "cursor-zoom-in motion-safe:hover:scale-[1.005]" : "cursor-default"}`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={formData.name || "Product"}
            className="max-w-full max-h-full w-auto h-auto object-contain rounded-xl border border-slate-200 bg-slate-50 shadow-sm"
          />
        ) : (
          <span className="w-full h-full rounded-xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-slate-400">
            <ImageIcon className="w-10 h-10 text-slate-300" />
            <span className="text-xs font-medium">No image yet</span>
            <span className="text-caption text-slate-400">
              Upload one, or pick from the library
            </span>
          </span>
        )}
      </button>

      {/* One row, never two: a wrapped second row costs ~40px of image height,
          which is exactly the space this pane exists to protect. The SKU hint
          truncates instead of pushing the buttons onto a new line. */}
      <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) void handleFilePicked(f);
            e.target.value = "";
          }}
        />
        {/* Gallery slots — products/{SKU}-2.webp, -3.webp … */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f)
              void uploadFile(f, uploadTarget.slot, uploadTarget.replaceId);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs flex-shrink-0"
          disabled={uploading || !active}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          Upload
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs flex-shrink-0"
          disabled={!active}
          onClick={() => setLibraryOpen(true)}
          title="Select from Library"
        >
          <Library className="w-3.5 h-3.5" />
          Library
        </Button>
        {/* Explicit expand control. Clicking the image does the same thing, but
            that affordance isn't discoverable on its own. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs flex-shrink-0"
          disabled={!previewUrl}
          onClick={() => setLightboxIndex(0)}
        >
          <Maximize2 className="w-3.5 h-3.5" /> Expand
        </Button>
        {formData.sku && (
          <span
            className="text-caption text-slate-400 ml-auto truncate min-w-0"
            title={`Uploads are stored as ${formData.sku}.webp`}
          >
            uploads → {formData.sku}.webp
          </span>
        )}
      </div>

      {/* Gallery filmstrip. Scrolls sideways rather than wrapping: in a locked
          shell an extra wrapped row would steal height from the image. */}
      <div className="flex gap-2 flex-shrink-0 overflow-x-auto pb-1">
        {galleryLoading ? (
          <Skeleton className="h-16 w-16 rounded-md" />
        ) : (
          gallery.map(img => {
            const url = normalizeImageUrl(img.image_url);
            const isPrimary = normalizeImageUrl(formData.image_url) === url;
            return (
              <div
                key={img.id}
                className="group relative w-16 h-16 flex-shrink-0 rounded-md border border-slate-200 overflow-hidden bg-slate-50"
              >
                <img
                  src={url}
                  alt={img.alt_text || ""}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {/* One overflow menu instead of two hover-only icon buttons:
                    the actions are then discoverable, labelled, and there is
                    room for Replace, which had nowhere to live before. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    {/* The whole 64px tile is the trigger — a 22px badge is
                        under the touch minimum, and the tile had no other
                        click action to compete with. The badge stays as the
                        visual affordance. */}
                    <button
                      type="button"
                      title="Image actions"
                      aria-label={`Actions for gallery image ${gallery.indexOf(img) + 1}`}
                      className="absolute inset-0 flex items-start justify-end p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400"
                    >
                      <span className="p-1 rounded-md bg-black/55 text-white group-hover:bg-black/75 transition-colors duration-150">
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem
                      disabled={isPrimary}
                      onClick={() => void setPrimaryImage(img.image_url)}
                      className="gap-2"
                    >
                      <Star className="w-3.5 h-3.5" />
                      {isPrimary ? "Already primary" : "Set as primary"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={uploading}
                      onClick={() => {
                        // Overwrite this slot AND patch this row, so the
                        // replacement keeps its position instead of appending.
                        setUploadTarget({
                          slot: gallery.indexOf(img) + 2,
                          replaceId: img.id,
                        });
                        galleryInputRef.current?.click();
                      }}
                      className="gap-2"
                    >
                      <Upload className="w-3.5 h-3.5" /> Replace
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => removeGalleryImage(img.id)}
                      className="gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isPrimary && (
                  <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[8px] font-bold text-white text-center">
                    PRIMARY
                  </span>
                )}
              </div>
            );
          })
        )}
        <button
          type="button"
          onClick={() => {
            setUploadTarget({ slot: gallery.length + 2 });
            galleryInputRef.current?.click();
          }}
          disabled={uploading || !active}
          title="Add a gallery image"
          className="w-16 h-16 flex-shrink-0 rounded-md border border-dashed border-slate-300 text-slate-400 hover:border-red-400 hover:text-red-500 flex items-center justify-center disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
        {!galleryLoading && gallery.length === 0 && (
          <p className="text-caption text-slate-400 self-center whitespace-nowrap">
            No extra images yet.
          </p>
        )}
      </div>
    </div>
  );

  // Drag to rebalance image ┃ fields; double-click resets. Clamped so the image
  // keeps IMAGE_MIN and the fields pane keeps FIELDS_MIN.
  const divider = (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize image and fields panes"
      title="Drag to resize · double-click to reset"
      onPointerDown={startDividerDrag}
      onDoubleClick={resetDivider}
      style={{ width: DIVIDER_W }}
      className="flex-shrink-0 cursor-col-resize rounded-full hover:bg-red-100 flex items-center justify-center group transition-colors duration-150"
    >
      <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-red-500" />
    </div>
  );

  const fieldsBody = (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <SectionHeading
          title="Basics"
          hint="What the product is called and where it sits in the catalogue."
        />
        <div>
          <Label className="text-xs">Product name</Label>
          <Input
            ref={nameInputRef}
            value={formData.name}
            onChange={e => updateForm("name", e.target.value)}
            onKeyDown={e => onFieldKeyDown(e)}
            onBlur={() => markTouched("name")}
            aria-invalid={!!shownError("name")}
            className={`${FIELD_CLS} ${errorClass("name")}`}
            placeholder="Full product name"
          />
          {renderFieldError("name")}
        </div>

        {/* Brand and SKU each take a full row. Paired in a 2-column grid they
            only had ~178px, which clipped real values from this catalogue —
            "HINGED-BOX-2000-ML" rendered as "HINGED-BOX-2000-Ml". Vertical
            space in this pane is not scarce; horizontal space is. */}
        <div>
          <Label className="text-xs">Brand</Label>
          <Input
            value={formData.brand}
            onChange={e => updateForm("brand", e.target.value)}
            onKeyDown={e => onFieldKeyDown(e)}
            className={FIELD_CLS}
            placeholder="Brand"
          />
        </div>
        <div>
          <Label className="text-xs">SKU</Label>
          <Input
            value={formData.sku}
            onChange={e => updateForm("sku", e.target.value)}
            onKeyDown={e => onFieldKeyDown(e)}
            className={`${FIELD_CLS} font-mono`}
            placeholder="XL0105"
          />
        </div>

        <div>
          <Label className="text-xs">Category</Label>
          <div className="mt-1">
            <CategoryCombobox
              categories={categories}
              value={formData.category_id}
              onChange={v => updateForm("category_id", v)}
              // Tab must pass THROUGH to Description; Enter/Space opens it.
              openOnFocus={false}
              // Matches the 44px field height. The combobox merges through
              // cn(), so a bare h-11 is enough to beat its own h-9.
              className="h-11 transition-shadow duration-150 focus:ring-2 focus:ring-red-300"
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Description</Label>
          <Textarea
            value={formData.description}
            onChange={e => updateForm("description", e.target.value)}
            onKeyDown={e => onFieldKeyDown(e)}
            rows={5}
            className={`${FIELD_CLS} resize-y min-h-[132px] h-auto`}
            placeholder="Short B2B description — material, size, use case…"
          />
          <p className="text-caption text-slate-400 mt-1">
            Enter makes a new line here. Ctrl+Enter saves.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <SectionHeading
          title="Pricing"
          hint="What ONE selling unit (the pack or case) costs, and the minimum order."
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs whitespace-nowrap">Price ₹</Label>
            <Input
              ref={priceInputRef}
              value={formData.price}
              onChange={e => updateForm("price", e.target.value)}
              onKeyDown={e => onFieldKeyDown(e)}
              onBlur={() => markTouched("price")}
              aria-invalid={!!shownError("price")}
              inputMode="decimal"
              className={`${FIELD_CLS} ${errorClass("price")}`}
              placeholder="blank = On Enquiry"
            />
            {renderFieldError("price")}
          </div>
          <div>
            <Label className="text-xs whitespace-nowrap">Pack qty</Label>
            <Input
              ref={qtyInputRef}
              value={formData.quantity_in_unit}
              onChange={e => updateForm("quantity_in_unit", e.target.value)}
              onKeyDown={e => onFieldKeyDown(e)}
              onBlur={() => markTouched("quantity_in_unit")}
              aria-invalid={!!shownError("quantity_in_unit")}
              inputMode="numeric"
              className={`${FIELD_CLS} ${errorClass("quantity_in_unit")}`}
              placeholder="e.g. 480"
            />
            {renderFieldError("quantity_in_unit") ?? (
              <p className="text-caption text-slate-400 mt-1 whitespace-nowrap">
                pcs per pack
              </p>
            )}
          </div>
        </div>

        {/* Price readout spans the full pane width — inside the 2-column grid
            it only had ~148px and wrapped into a vertical stack. */}
        <p className="text-caption -mt-1">
          {priceInvalid ? (
            <span className="text-red-600 font-semibold">
              Not a number — this won't save
            </span>
          ) : onEnquiry ? (
            <span className="text-amber-700 font-semibold">
              On Enquiry — no price shown on the storefront
            </span>
          ) : (
            <span className="text-slate-500">
              ₹{Number(priceNum).toLocaleString()} per pack of{" "}
              {formData.quantity_in_unit || "?"} {formData.unit_of_measure}
              {perPiece != null && (
                <>
                  {" "}
                  ·{" "}
                  <strong className="font-semibold">
                    ₹{(Math.round(perPiece * 100) / 100).toLocaleString()}/pc
                  </strong>
                </>
              )}
            </span>
          )}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs whitespace-nowrap">MOQ (packs)</Label>
            <Input
              ref={moqInputRef}
              value={formData.moq}
              onChange={e => updateForm("moq", e.target.value)}
              onKeyDown={e => onFieldKeyDown(e)}
              onBlur={() => markTouched("moq")}
              aria-invalid={!!shownError("moq")}
              inputMode="numeric"
              className={`${FIELD_CLS} ${errorClass("moq")}`}
              placeholder="e.g. 1"
            />
            {renderFieldError("moq")}
          </div>
          <div>
            <Label className="text-xs">Unit</Label>
            <Select
              value={formData.unit_of_measure}
              onValueChange={v => updateForm("unit_of_measure", v)}
            >
              {/* `data-[size=default]:h-11` not plain `h-11`: SelectTrigger's own
                `data-[size=default]:h-9` is an attribute selector and outranks
                a bare utility, so the trigger stayed 36px while every input
                next to it was 44. `w-full` because the trigger is `w-fit`. */}
              <SelectTrigger
                className={`${FIELD_CLS} w-full data-[size=default]:h-11`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map(u => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-100 pt-4">
        <SectionHeading
          title="Publishing"
          hint="Whether customers can see this product on the storefront."
        />
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
          <div>
            <Label className="text-xs">Published</Label>
            <p className="text-caption text-slate-400">
              Draft products never appear on the storefront.
            </p>
          </div>
          <Switch
            checked={formData.status === "published"}
            onCheckedChange={c =>
              updateForm("status", (c ? "published" : "draft") as ProductStatus)
            }
          />
        </div>
      </section>
    </div>
  );

  // Pinned to the bottom of the fields pane, outside its scroll area, so
  // Save & Next is reachable no matter how far down the fields are scrolled.
  const actions = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 transition-colors duration-150"
        disabled={activeIndex <= 0 || busy}
        title="Previous product"
        onClick={() => goTo(activeIndex - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      {/* `busy` spans the WHOLE commit, not just useProductForm's `saving`: the
          row patch, Undo toast and aggregate refresh all run after the request
          resolves, and a second click landing in that window would fire a
          duplicate update. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 gap-1.5 transition-colors duration-150"
        disabled={busy || !active}
        onClick={() => void doSave(false)}
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-9 flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5 transition-colors duration-150"
        disabled={busy || !active}
        onClick={() => void doSave(true)}
      >
        {busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            Save &amp; Next <ChevronRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );

  const fieldsPane = stacked ? (
    <div className="w-full p-3 flex flex-col gap-3">
      {fieldsBody}
      {actions}
    </div>
  ) : (
    // Fixed (drag-resizable) width, never shrinks — this pane is what got
    // crushed when it was flex-1. Body scrolls; the action bar does not.
    <div
      className="flex-shrink-0 flex flex-col min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden"
      style={{ width: effFieldsWidth }}
    >
      <div className="flex-1 overflow-y-auto min-h-0 p-4">{fieldsBody}</div>
      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        {actions}
      </div>
    </div>
  );

  return (
    <div
      ref={shellRef}
      className={
        isMobile
          ? "bg-white border border-slate-200 rounded-xl overflow-hidden"
          : // flex-1, not h-full: a percentage height needs a definite parent,
            // whereas flex-1 + min-h-0 is capped by the column above it
            // regardless of how that column got its size. The shell itself is
            // transparent — each pane below is its own white card.
            "flex-1 flex flex-col min-h-0"
      }
      style={isMobile ? undefined : { minHeight: MIN_SHELL_H }}
    >
      {stacked ? (
        // Still inside the locked shell on desktop, so the column scrolls
        // within it rather than pushing the page.
        <div
          className={
            isMobile
              ? "flex flex-col"
              : "flex flex-col flex-1 min-h-0 overflow-y-auto"
          }
        >
          {listPane}
          {imagePane}
          {fieldsPane}
        </div>
      ) : (
        <div className="flex items-stretch flex-1 min-h-0 gap-3">
          {listPane}
          {imagePane}
          {divider}
          {fieldsPane}
        </div>
      )}

      {/* Library picker */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        {/* Big enough to actually browse a few hundred files: the picker lays
            itself out as a flex column, so the grid scrolls inside the dialog
            rather than the dialog scrolling as a whole. */}
        <DialogContent className="w-[90vw] max-w-[1400px] h-[85vh] flex flex-col gap-3 overflow-hidden sm:max-w-[1400px]">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Select image</DialogTitle>
            <DialogDescription>
              {formData.sku
                ? `Files named after ${formData.sku} are listed first.`
                : "Pick an existing image for this product."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <AdminImageLibrary
              isSelectionMode
              skuHint={formData.sku}
              onCancel={() => setLibraryOpen(false)}
              onSelectImage={url => {
                void setPrimaryImage(url);
                setLibraryOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Existing-file-for-this-SKU prompt */}
      <Dialog open={skuPromptOpen} onOpenChange={setSkuPromptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>This SKU already has an image</DialogTitle>
            <DialogDescription>
              {skuMatches.length} file
              {skuMatches.length === 1 ? "" : "s"} named after{" "}
              <strong>{formData.sku}</strong>{" "}
              {skuMatches.length === 1 ? "is" : "are"} already in the bucket.
              Attaching reuses it; uploading replaces it.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {skuMatches.map(m => (
              <button
                key={m.name}
                type="button"
                onClick={() => {
                  void setPrimaryImage(m.url);
                  setSkuPromptOpen(false);
                  pendingFileRef.current = null;
                  toast.success("Attached existing image");
                }}
                className="w-20 h-20 rounded-md border border-slate-200 overflow-hidden hover:border-red-400"
                title={m.name}
              >
                <img
                  src={m.url}
                  alt={m.name}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSkuPromptOpen(false);
                pendingFileRef.current = null;
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const f = pendingFileRef.current;
                setSkuPromptOpen(false);
                pendingFileRef.current = null;
                if (f) void uploadFile(f, 1);
              }}
            >
              <Upload className="w-3.5 h-3.5" /> Replace with my upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full-page lightbox. Esc and the backdrop close it (Radix handles Esc;
          the backdrop is the content itself, since a full-bleed panel leaves
          no overlay to click). Arrow keys walk the gallery — see the effect
          above. */}
      <Dialog
        open={lightboxIndex != null}
        onOpenChange={open => !open && setLightboxIndex(null)}
      >
        <DialogContent
          showCloseButton={false}
          onClick={() => setLightboxIndex(null)}
          className="w-screen h-dvh max-w-none sm:max-w-none translate-x-[-50%] translate-y-[-50%] rounded-none border-0 bg-slate-950/95 p-0 gap-0 grid-rows-[auto_1fr_auto] cursor-zoom-out"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{formData.name || "Product image"}</DialogTitle>
            <DialogDescription>
              Full-page image view. Press Escape to close
              {allImages.length > 1
                ? ", or the left and right arrow keys to move through the gallery."
                : "."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white/80">
            <p className="text-sm truncate" title={lightboxImage?.name}>
              {lightboxImage?.name}
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              {allImages.length > 1 && (
                <span className="text-xs text-white/50 tabular-nums">
                  {(lightboxIndex ?? 0) + 1} / {allImages.length}
                </span>
              )}
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex items-center justify-center gap-3 px-4">
            {allImages.length > 1 && (
              <button
                type="button"
                aria-label="Previous image"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxIndex(i =>
                    i == null
                      ? i
                      : (i - 1 + allImages.length) % allImages.length
                  );
                }}
                className="flex-shrink-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            {lightboxImage && (
              <img
                src={lightboxImage.url}
                alt={formData.name || lightboxImage.name}
                // Stop the click here so only the backdrop closes.
                onClick={e => e.stopPropagation()}
                className="max-w-full max-h-full w-auto h-auto object-contain cursor-default"
              />
            )}
            {allImages.length > 1 && (
              <button
                type="button"
                aria-label="Next image"
                onClick={e => {
                  e.stopPropagation();
                  setLightboxIndex(i =>
                    i == null ? i : (i + 1) % allImages.length
                  );
                }}
                className="flex-shrink-0 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          <p className="px-4 py-3 text-caption text-white/40 flex items-center gap-1.5 truncate">
            <Link2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lightboxImage?.url}</span>
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
