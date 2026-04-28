import type { RunLogEntry } from "../../state/sessionTypes";
import { PanelSection, classNames } from "../../ui";
import styles from "./RunLog.module.css";

export function RunLog({ entries }: { entries: RunLogEntry[] }) {
  return (
    <PanelSection kicker="Run Log">
      <div className={styles.log}>
        {entries.length === 0 ? (
          <p className={styles.empty}>
            Workspace events will show up here as you open docs, Everlink selections, and place
            slices.
          </p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className={entryClassName(entry.tone)}>
              <div className={styles.meta}>
                <span>{entry.createdAt}</span>
                <span>{entry.tone}</span>
              </div>
              <p>{entry.message}</p>
            </article>
          ))
        )}
      </div>
    </PanelSection>
  );
}

function entryClassName(tone: RunLogEntry["tone"]): string {
  return classNames(
    styles.entry,
    tone === "success" && styles.success,
    tone === "warn" && styles.warn,
  );
}
