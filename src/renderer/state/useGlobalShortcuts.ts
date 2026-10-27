// Window-level keyboard shortcuts for the highlighting toggles. Handlers
// are read through a ref so the listener binds once.

import { useEffect, useRef } from "react";

export type GlobalShortcutHandlers = {
  toggleHighlights: () => void;
  toggleSlices: () => void;
};

export function useGlobalShortcuts(handlers: GlobalShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === "h") {
        event.preventDefault();
        handlersRef.current.toggleHighlights();
      } else if (key === "j") {
        event.preventDefault();
        handlersRef.current.toggleSlices();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
