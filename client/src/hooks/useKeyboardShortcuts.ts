import { useEffect, useRef } from "react";

interface KeyboardShortcutActions {
  enabled?: boolean;
  focusQuickAdd?: () => void;
  focusSearch?: () => void;
  save?: () => void;
  saveAndAddAnother?: () => void;
  cancel?: () => void;
  showHelp?: () => void;
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    !!target.closest('[contenteditable="true"]')
  );
}

export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (actionsRef.current.enabled === false) return;
      if (isTypingTarget(event.target)) return;
      const current = actionsRef.current;

      const key = event.key.toLowerCase();
      if (
        event.ctrlKey &&
        event.shiftKey &&
        key === "enter" &&
        current.saveAndAddAnother
      ) {
        event.preventDefault();
        current.saveAndAddAnother();
        return;
      }
      if (event.ctrlKey && key === "enter" && current.save) {
        event.preventDefault();
        current.save();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (key === "n" && current.focusQuickAdd) {
        event.preventDefault();
        current.focusQuickAdd();
      } else if (key === "/" && current.focusSearch) {
        event.preventDefault();
        current.focusSearch();
      } else if (key === "escape" && current.cancel) {
        event.preventDefault();
        current.cancel();
      } else if (key === "?" && current.showHelp) {
        event.preventDefault();
        current.showHelp();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
