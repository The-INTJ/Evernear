import type { StoredDocumentSnapshot } from "../../../shared/domain/document";
import { classNames } from "../../ui";
import styles from "./TitleBar.module.css";

type Props = {
  activeDocument: StoredDocumentSnapshot | null;
  documentTitleDraft: string;
  onDocumentTitleDraftChange: (value: string) => void;
  onSaveDocumentMeta: () => void;
  highlightsEnabled: boolean;
  slicesVisible: boolean;
  onToggleHighlights: () => void;
  onToggleSlices: () => void;
  pendingWrites: number;
  saveError: string | null;
};

// The frameless window's drag region. Native window controls (min/max/close)
// are painted by Electron's titleBarOverlay on the right edge, so every
// interactive control opts out of dragging.
export function TitleBar({
  activeDocument,
  documentTitleDraft,
  onDocumentTitleDraftChange,
  onSaveDocumentMeta,
  highlightsEnabled,
  slicesVisible,
  onToggleHighlights,
  onToggleSlices,
  pendingWrites,
  saveError,
}: Props) {
  return (
    <header className={styles.titleBar}>
      <input
        aria-label="Document title"
        className={styles.title}
        disabled={activeDocument === null}
        value={documentTitleDraft}
        onChange={(event) => onDocumentTitleDraftChange(event.target.value)}
        onBlur={() => onSaveDocumentMeta()}
        placeholder="No document"
      />

      <div className={styles.toggles} aria-label="Highlighting">
        <Toggle label="Entities" on={highlightsEnabled} shortcut="Ctrl+H" onClick={onToggleHighlights} />
        <Toggle label="Slices" on={slicesVisible} shortcut="Ctrl+J" onClick={onToggleSlices} />
      </div>

      <SaveStatus pendingWrites={pendingWrites} saveError={saveError} />
    </header>
  );
}

function Toggle({
  label,
  on,
  shortcut,
  onClick,
}: {
  label: string;
  on: boolean;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={on}
      className={classNames(styles.toggle, on && styles.on)}
      onClick={onClick}
      title={`${on ? "Hide" : "Show"} ${label.toLowerCase()} (${shortcut})`}
      type="button"
    >
      {label}
    </button>
  );
}

function SaveStatus({ pendingWrites, saveError }: { pendingWrites: number; saveError: string | null }) {
  if (saveError) {
    return (
      <span className={classNames(styles.save, styles.failed)} title={saveError}>
        Not saved
      </span>
    );
  }
  return <span className={styles.save}>{pendingWrites > 0 ? "Saving..." : "Saved"}</span>;
}
