// Window-level keyboard shortcuts for the three toggles, plus Esc to leave
// slice editing. Handlers are read through a ref so the listener binds once.

import { useEffect, useRef } from "react";

export type GlobalShortcutHandlers = {
  toggleHighlights: () => void;
  toggleSlices: () => void;
  toggleEditingSlices: () => void;
  // Returns false when there was nothing to escape from, so the key keeps
  // its usual meaning.
  escape: () => boolean;
};

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Not gated on defaultPrevented: ProseMirror marks every Escape it
      // sees as handled. Dialogs stop their own Escape before it gets here.
      if (event.key === "Escape") {
        if (handlersRef.current.escape()) event.preventDefault();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        handlersRef.current.toggleHighlights();
      } else if (key === "j") {
        event.preventDefault();
        handlersRef.current.toggleSlices();
      } else if (key === "e") {
        event.preventDefault();
        handlersRef.current.toggleEditingSlices();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
