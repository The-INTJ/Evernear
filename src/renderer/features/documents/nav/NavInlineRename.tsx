import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

import styles from "./NavTree.module.css";

type Props = {
  initialValue: string;
  ariaLabel: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
};

export function NavInlineRename(props: Props) {
  const { initialValue, ariaLabel, onCommit, onCancel } = props;
  const [draft, setDraft] = useState(initialValue);
  const cancelledRef = useRef(false);

  // Reset the draft if a fresh rename target is mounted in place of a
  // previous one without unmounting (rare but possible if the user
  // right-click-renames two siblings in quick succession).
  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const handleBlur = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      return;
    }
    onCommit(draft);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      cancelledRef.current = true;
      setDraft(initialValue);
      onCancel();
    }
  };

  return (
    <input
      aria-label={ariaLabel}
      autoFocus
      className={styles.renameInput}
      onBlur={handleBlur}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={handleKeyDown}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      value={draft}
    />
  );
}
