import { useEffect } from "react";

import type { Notice } from "../../state/sessionTypes";
import styles from "./NoticeBar.module.css";

const NOTICE_VISIBLE_MS = 6000;

type Props = {
  notice: Notice | null;
  onDismiss: () => void;
};

// One line at the bottom of the window for the latest warning. It fades on
// its own; clicking dismisses it early.
export function NoticeBar({ notice, onDismiss }: Props) {
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(onDismiss, NOTICE_VISIBLE_MS);
    return () => clearTimeout(timeout);
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <button className={styles.notice} type="button" role="status" onClick={onDismiss}>
      {notice.message}
    </button>
  );
}
