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

interface ConfirmRequest {
  options: ConfirmOptions;
  resolver: (value: boolean) => void;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  // Bumped every time a new request becomes the active one (including the
  // transition back to idle) — lets settle() detect a stale close event from
  // a cycle that's already been superseded. See settle() below.
  id: number;
}

const useConfirmStore = create<ConfirmState>(() => ({
  open: false,
  options: null,
  resolver: null,
  id: 0,
}));

let nextId = 0;

// Requests that arrive while a confirm() is already showing. Processed FIFO
// once the active one settles, so no caller's promise is ever silently
// orphaned by a later confirm() replacing the store's state out from under it.
const queue: ConfirmRequest[] = [];

function activate(request: ConfirmRequest) {
  useConfirmStore.setState({
    open: true,
    options: request.options,
    resolver: request.resolver,
    id: ++nextId,
  });
}

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    const request: ConfirmRequest = { options, resolver: resolve };
    if (useConfirmStore.getState().open) {
      queue.push(request);
    } else {
      activate(request);
    }
  });
}

// Settles the in-flight promise for cycle `forId` exactly once, then either
// activates the next queued request or goes idle. Guarded by `id` because the
// Action button's onClick and Radix's own onOpenChange both fire a close for
// the SAME dialog instance in the same synchronous event — without the guard,
// the second (stale) call would land after we've already activated the next
// queued request and incorrectly resolve THAT one as cancelled.
function settle(value: boolean, forId: number) {
  const state = useConfirmStore.getState();
  if (state.id !== forId) return;
  const { resolver } = state;
  const next = queue.shift();
  if (next) {
    activate(next);
  } else {
    useConfirmStore.setState({ open: false, resolver: null, id: ++nextId });
  }
  resolver?.(value);
}

export function ConfirmDialogHost() {
  const { open, options, id } = useConfirmStore();
  if (!options) return null;
  return (
    <AlertDialog open={open} onOpenChange={o => !o && settle(false, id)}>
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
            onClick={() => settle(true, id)}
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
