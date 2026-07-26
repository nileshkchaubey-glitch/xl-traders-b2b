import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "lucide-react";
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
const LIST_W = 240;
const DIVIDER_W = 8;
const FIELDS_MIN = 340;
const FIELDS_DEFAULT = 400;
const IMAGE_MIN = 320;
/** Divider position lives in the URL — same no-localStorage rule as DataTable. */
const WIDTH_PARAM = "wbW";
/**
 * Guard against an absurdly short viewport — deliberately NOT a target height.
 * Every pane scrolls internally, so a short shell only costs image height,
 * whereas a floor set anywhere near a real laptop's available space pushes the
 * shell past the fold and hands back the page scrolling this lock removes.
 * (1366x768 leaves ~333px after browser chrome and the editor's own toolbars;
 * a 340 floor was already enough to reintroduce a scrollbar there.)
 */
const MIN_SHELL_H = 280;

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
}: CatalogWorkbenchProps) {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { formData, updateForm, load, saving, save } = useProductForm(null);
  const { committingRef, isFlashing, flashSaved } = useSaveFeedback();

  const [gallery, setGallery] = useState<ProductImage[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);

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
  // The entry loop is "look at the photo, type, Save & Next". If the page
  // scrolls, Save & Next drifts below the fold and the image scrolls out of
  // view — so the shell is sized to end exactly at the viewport bottom and each
  // pane scrolls inside it. Because the shell then consumes precisely the space
  // that was left, the page itself has nothing to scroll, which keeps the
  // measured top stable.
  const [shellHeight, setShellHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (isMobile) {
      setShellHeight(null);
      return;
    }
    const measure = () => {
      const el = shellRef.current;
      if (!el) return;
      // The admin content area scrolls, not the window.
      let scroller: HTMLElement | null = el.parentElement;
      while (scroller) {
        const oy = getComputedStyle(scroller).overflowY;
        if (oy === "auto" || oy === "scroll") break;
        scroller = scroller.parentElement;
      }

      if (!scroller) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        setShellHeight(
          Math.max(MIN_SHELL_H, Math.round(window.innerHeight - top))
        );
        return;
      }

      // Everything above the shell, and everything below it (sibling rows plus
      // the wrapper's own bottom padding), measured rather than assumed — a
      // hardcoded gutter left 8px of page scroll, which is the exact thing this
      // lock exists to remove. `below` doesn't change when the shell's height
      // changes, so this converges in a single pass.
      const above =
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      const below = scroller.scrollHeight - (above + el.offsetHeight);
      setShellHeight(
        Math.max(MIN_SHELL_H, Math.round(scroller.clientHeight - above - below))
      );
    };
    measure();
    // Re-measure after paint: web fonts can reflow the toolbar above us and
    // shift our top by a row's worth of pixels.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [isMobile]);

  // ── Draggable image ┃ fields divider ───────────────────────────────────────
  const [, setLocation] = useLocation();
  const [fieldsWidth, setFieldsWidth] = useState(() => {
    const raw = Number(
      new URLSearchParams(window.location.search).get(WIDTH_PARAM)
    );
    return Number.isFinite(raw) && raw >= FIELDS_MIN ? raw : FIELDS_DEFAULT;
  });
  const [containerW, setContainerW] = useState(0);
  const widthRef = useRef(fieldsWidth);

  useEffect(() => {
    const el = shellRef.current;
    if (!el || isMobile) return;
    const ro = new ResizeObserver(([entry]) =>
      setContainerW(entry.contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile]);

  // Clamp against the CURRENT container, not just the stored value: a width
  // dragged wide at 1920 must not push the image below its minimum at 1280.
  const maxFieldsWidth = containerW
    ? Math.max(FIELDS_MIN, containerW - LIST_W - DIVIDER_W - IMAGE_MIN)
    : Number.POSITIVE_INFINITY;
  const effFieldsWidth = Math.min(
    Math.max(fieldsWidth, FIELDS_MIN),
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
                  containerW - LIST_W - DIVIDER_W - IMAGE_MIN
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
    [containerW, persistWidth]
  );

  const resetDivider = useCallback(() => {
    widthRef.current = FIELDS_DEFAULT;
    setFieldsWidth(FIELDS_DEFAULT);
    persistWidth(FIELDS_DEFAULT);
  }, [persistWidth]);

  const activeIndex = useMemo(
    () => products.findIndex(p => p.id === activeId),
    [products, activeId]
  );
  const active = activeIndex >= 0 ? products[activeIndex] : null;

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
    async (file: File, slot: number) => {
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
        if (slot === 1) await setPrimaryImage(url);
        else await addToGallery(url);
        toast.success(sku ? `Uploaded as ${sku}` : "Uploaded");
      } catch {
        toast.error("Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [active, addToGallery, formData.sku, setPrimaryImage]
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
        isMobile
          ? "w-full"
          : "flex-shrink-0 border-r border-slate-200 flex flex-col min-h-0"
      }
      style={isMobile ? undefined : { width: LIST_W }}
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
          isMobile
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
          <p className="p-4 text-xs text-slate-400">
            No products in this view.
          </p>
        ) : (
          products.map((p, i) => {
            const isActive = p.id === activeId;
            return (
              <button
                key={p.id}
                data-pid={p.id}
                onClick={() => void selectProduct(p.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 border-b border-slate-100 transition-colors ${
                  isActive
                    ? "bg-red-50 border-l-2 border-l-red-600"
                    : isFlashing(p.id)
                      ? "bg-emerald-50"
                      : "hover:bg-slate-50 border-l-2 border-l-transparent"
                }`}
              >
                <span className="w-8 h-8 rounded border border-slate-200 bg-slate-50 overflow-hidden flex-shrink-0 flex items-center justify-center">
                  {p.image_url ? (
                    <img
                      src={normalizeImageUrl(p.image_url)}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-slate-300" />
                  )}
                </span>
                <span className="flex-1 min-w-0">
                  <span
                    className={`block truncate text-xs ${isActive ? "font-semibold text-red-700" : "text-slate-700"}`}
                  >
                    {p.name}
                  </span>
                  <span className="block truncate text-caption text-slate-400">
                    {pageOffset + i} · {p.sku || "no SKU"}
                  </span>
                </span>
                {incompleteIds.has(p.id) ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const imagePane = (
    <div
      className={
        isMobile
          ? "w-full p-3 border-b border-slate-200"
          : // Image is the FLEXIBLE pane: it absorbs whatever the fixed list
            // and the (resizable) fields pane don't need, rather than claiming
            // a fixed width and squeezing the fields into what's left (DE-08).
            // min-w-0 because the drag clamp, not flexbox, enforces IMAGE_MIN.
            "flex-1 min-w-0 p-4 flex flex-col gap-3 min-h-0"
      }
    >
      {/* THE large image. flex-1 so it grows to whatever the locked shell
          leaves after the button row and filmstrip — the photo is the point of
          this surface, so it gets the slack rather than empty container.
          object-contain on a neutral field so packaging shapes read correctly
          and nothing is cropped away. */}
      <button
        type="button"
        onClick={() => previewUrl && setZoomOpen(true)}
        disabled={!previewUrl}
        title={previewUrl ? "Click to expand" : undefined}
        className={`w-full ${isMobile ? "aspect-square" : "flex-1 min-h-[200px]"} rounded-xl border border-slate-200 bg-slate-100 overflow-hidden flex items-center justify-center ${previewUrl ? "cursor-zoom-in" : "cursor-default"}`}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt={formData.name || "Product"}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="flex flex-col items-center gap-2 text-slate-300">
            <ImageIcon className="w-12 h-12" />
            <span className="text-xs">No image yet</span>
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
            if (f) void uploadFile(f, gallery.length + 2);
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
          onClick={() => setZoomOpen(true)}
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
                <div className="absolute inset-0 hidden group-hover:flex items-center justify-center gap-1 bg-black/40">
                  <button
                    type="button"
                    title={isPrimary ? "Primary image" : "Set as primary"}
                    onClick={() => void setPrimaryImage(img.image_url)}
                    className={`p-1 rounded ${isPrimary ? "text-amber-300" : "text-white hover:text-amber-300"}`}
                  >
                    <Star
                      className="w-3.5 h-3.5"
                      fill={isPrimary ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    type="button"
                    title="Remove"
                    onClick={() => removeGalleryImage(img.id)}
                    className="p-1 rounded text-white hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
          onClick={() => galleryInputRef.current?.click()}
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
      className="flex-shrink-0 cursor-col-resize bg-slate-50 hover:bg-red-100 border-x border-slate-200 flex items-center justify-center group transition-colors"
    >
      <GripVertical className="w-3 h-3 text-slate-300 group-hover:text-red-500" />
    </div>
  );

  const fieldsBody = (
    <div className="grid grid-cols-1 gap-3">
      <div>
        <Label className="text-xs">Product name</Label>
        <Input
          ref={nameInputRef}
          value={formData.name}
          onChange={e => updateForm("name", e.target.value)}
          onKeyDown={e => onFieldKeyDown(e)}
          onBlur={() => markTouched("name")}
          aria-invalid={!!shownError("name")}
          className={`h-9 text-sm mt-1 ${errorClass("name")}`}
          placeholder="Full product name"
        />
        {renderFieldError("name")}
      </div>

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
            className={`h-9 text-sm mt-1 ${errorClass("price")}`}
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
            className={`h-9 text-sm mt-1 ${errorClass("quantity_in_unit")}`}
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
            className={`h-9 text-sm mt-1 ${errorClass("moq")}`}
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
            <SelectTrigger className="h-9 text-sm mt-1">
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
          className="h-9 text-sm mt-1"
          placeholder="Brand"
        />
      </div>
      <div>
        <Label className="text-xs">SKU</Label>
        <Input
          value={formData.sku}
          onChange={e => updateForm("sku", e.target.value)}
          onKeyDown={e => onFieldKeyDown(e)}
          className="h-9 text-sm mt-1 font-mono"
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
          className="text-sm mt-1 resize-y min-h-[132px]"
          placeholder="Short B2B description — material, size, use case…"
        />
        <p className="text-caption text-slate-400 mt-1">
          Enter makes a new line here. Ctrl+Enter saves.
        </p>
      </div>

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
        className="h-9"
        disabled={activeIndex <= 0}
        onClick={() => goTo(activeIndex - 1)}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9"
        disabled={saving || !active}
        onClick={() => void doSave(false)}
      >
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        className="h-9 flex-1 bg-red-600 hover:bg-red-700 text-white gap-1.5"
        disabled={saving || !active}
        onClick={() => void doSave(true)}
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Save &amp; Next <ChevronRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );

  const fieldsPane = isMobile ? (
    <div className="w-full p-3 flex flex-col gap-3">
      {fieldsBody}
      {actions}
    </div>
  ) : (
    // Fixed (drag-resizable) width, never shrinks — this pane is what got
    // crushed when it was flex-1. Body scrolls; the action bar does not.
    <div
      className="flex-shrink-0 flex flex-col min-h-0"
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
      className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      style={isMobile || !shellHeight ? undefined : { height: shellHeight }}
    >
      {isMobile ? (
        <div className="flex flex-col">
          {listPane}
          {imagePane}
          {fieldsPane}
        </div>
      ) : (
        <div className="flex items-stretch h-full min-h-0">
          {listPane}
          {imagePane}
          {divider}
          {fieldsPane}
        </div>
      )}

      {/* Library picker */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select image</DialogTitle>
            <DialogDescription className="sr-only">
              Pick an existing image for this product
            </DialogDescription>
          </DialogHeader>
          <AdminImageLibrary
            isSelectionMode
            onSelectImage={url => {
              void setPrimaryImage(url);
              setLibraryOpen(false);
            }}
          />
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

      {/* Zoom */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="text-sm">{formData.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Full-size product image
            </DialogDescription>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt={formData.name}
              className="w-full max-h-[75vh] object-contain"
            />
          )}
          <p className="text-caption text-slate-400 flex items-center gap-1">
            <Link2 className="w-3 h-3" /> {previewUrl}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
