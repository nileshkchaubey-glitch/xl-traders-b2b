import { create } from "zustand";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Imperative confirm() — mirrors sonner's toast() pattern: call it from any
// plain async function (no hook needed), it resolves true/false once the user
// picks, and a single <ConfirmDialogHost/> (mounted once in App.tsx) renders
// the actual dialog. Replaces window.confirm() admin-wide with a styled,
// on-brand AlertDialog while keeping every call site a simple await.
export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button + defaults confirmLabel to "Delete". For truly irreversible actions. */
  destructive?: boolean;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  options: null,
  resolver: null,
}));

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    useConfirmStore.setState({ open: true, options, resolver: resolve });
  });
}

// Settles the in-flight promise exactly once. Safe to call twice (e.g. the
// Action button's onClick fires settle(true), then Radix's own onOpenChange
// fires settle(false) right after) — the second call is a no-op because
// resolver is already null by then.
function settle(value: boolean) {
  const { resolver } = useConfirmStore.getState();
  useConfirmStore.setState({ open: false, resolver: null });
  resolver?.(value);
}

export function ConfirmDialogHost() {
  const { open, options } = useConfirmStore();
  if (!options) return null;
  return (
    <AlertDialog open={open} onOpenChange={o => !o && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && (
            <AlertDialogDescription className="whitespace-pre-line">
              {options.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {options.cancelLabel ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settle(true)}
            className={
              options.destructive
                ? "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300"
                : undefined
            }
          >
            {options.confirmLabel ?? (options.destructive ? "Delete" : "Continue")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
