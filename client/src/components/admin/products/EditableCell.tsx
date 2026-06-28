import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

interface EditableCellProps {
  // Current raw value as a string (e.g. price as "120", "" = empty).
  value: string;
  type?: "text" | "number";
  placeholder?: string;
  // Rendered when not editing.
  display: React.ReactNode;
  // Commit the raw string; parent maps it to a patch + optimistic update.
  onCommit: (raw: string) => void;
}

// Click-to-edit cell used inside the products list (price). Commits on Enter or
// blur, cancels on Escape. Stops click propagation so editing a cell doesn't
// also open the row drawer.
export default function EditableCell({
  value,
  type = "text",
  placeholder,
  display,
  onCommit,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type={type}
        value={draft}
        placeholder={placeholder}
        onChange={e => setDraft(e.target.value)}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(false);
        }}
        onBlur={commit}
        className="h-7 w-24 text-sm"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        setEditing(true);
      }}
      className="group/cell rounded px-1.5 py-0.5 text-left hover:bg-slate-100"
      title="Click to edit"
    >
      {display}
      <span className="ml-1 text-xs opacity-0 group-hover/cell:opacity-40">
        ✎
      </span>
    </button>
  );
}
