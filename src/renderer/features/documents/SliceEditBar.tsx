import type { SliceEditingSummary } from "../../utils/workspace";
import { truncate } from "../../utils/formatting";
import styles from "./SliceEditBar.module.css";

type Props = {
  summary: SliceEditingSummary;
  onRemoveSlice: (sliceId: string) => void;
  onPlaceSlice: (sliceId: string) => void;
  onDone: () => void;
};

// Shown above the editor while Edit slices is on. The colored frame around
// the editor says which mode you're in; this bar says what you can do.
export function SliceEditBar({ summary, onRemoveSlice, onPlaceSlice, onDone }: Props) {
  const { focused, lost } = summary;
  const firstLost = lost[0];

  return (
    <div className={styles.bar} role="toolbar" aria-label="Slice editing">
      <span className={styles.mode}>Editing slices</span>
      {focused ? (
        <>
          <span className={styles.focus}>{focused.entityNames.join(", ")}</span>
          <button className={styles.action} type="button" onClick={() => onRemoveSlice(focused.sliceId)}>
            Remove slice
          </button>
        </>
      ) : (
        <span className={styles.hint}>Drag a slice's handles to change what it covers.</span>
      )}
      {firstLost ? (
        <span className={styles.lost}>
          Lost: &ldquo;{truncate(firstLost.text, 36)}&rdquo;
          <button
            className={styles.action}
            type="button"
            title="Select the text this slice should cover first"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPlaceSlice(firstLost.sliceId)}
          >
            Place on selection
          </button>
          {lost.length > 1 ? <span className={styles.more}>+{lost.length - 1} more</span> : null}
        </span>
      ) : null}
      <span className={styles.spacer} />
      <button className={styles.done} type="button" onClick={onDone} title="Leave slice editing (Esc)">
        Done
      </button>
    </div>
  );
}
