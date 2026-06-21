import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SHORTCUTS = [
  ["N", "Focus quick-add name"],
  ["/", "Focus product search"],
  ["Ctrl + Enter", "Save current form"],
  ["Ctrl + Shift + Enter", "Save and add another"],
  ["Esc", "Cancel or go back"],
  ["?", "Show this help"],
];

export default function KeyboardShortcutsDialog({
  open,
  onOpenChange,
  editor = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor?: boolean;
}) {
  const visible = SHORTCUTS.filter(([shortcut]) => {
    if (editor) return shortcut !== "N" && shortcut !== "/";
    return shortcut !== "Ctrl + Shift + Enter";
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shortcuts pause while you are typing in a form field.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {visible.map(([shortcut, description]) => (
            <div
              key={shortcut}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-slate-600">{description}</span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-xs text-slate-700">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
