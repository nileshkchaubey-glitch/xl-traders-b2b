import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface InlineCellProps {
  // Editing is CONTROLLED by the grid (so keyboard "e" can start an edit and
  // only one cell edits at a time).
  editing: boolean;
  // Current raw value as a string ("" = empty/null).
  value: string;
  type?: "text" | "number";
  placeholder?: string;
  // Rendered when not editing.
  display: React.ReactNode;
  inputClassName?: string;
  onStartEdit: () => void;
  // Commit the raw string; the grid maps it to a typed patch.
  onCommit: (raw: string) => void;
  onCancel: () => void;
}

// Double-click-to-edit cell for the admin-v2 product grid. Commits on Enter or
// blur, cancels on Escape. Double-click stops propagation so it never also
// triggers the row-level open; single clicks pass through so the row still
// receives focus.
export default function InlineCell({
  editing,
  value,
  type = "text",
  placeholder,
  display,
  inputClassName = "h-7 w-24 text-sm",
  onStartEdit,
  onCommit,
  onCancel,
}: InlineCellProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape triggers both keydown-cancel and blur; this ref keeps the blur
  // from committing the value the user just discarded.
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (editing) {
      cancelledRef.current = false;
      setDraft(value);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onClick={e => e.stopPropagation()}
        onDoubleClick={e => e.stopPropagation()}
        onKeyDown={e => {
          e.stopPropagation(); // keep grid arrows/Enter/e out of the input
          if (e.key === "Enter") onCommit(draft);
          else if (e.key === "Escape") {
            cancelledRef.current = true;
            onCancel();
          }
        }}
        onBlur={() => {
          if (!cancelledRef.current) onCommit(draft);
        }}
        className={inputClassName}
      />
    );
  }

  return (
    <div
      onDoubleClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      className="group/cell rounded px-1.5 py-0.5 -mx-1.5 cursor-default select-none hover:bg-slate-100"
      title="Double-click to edit"
    >
      {display}
    </div>
  );
}
