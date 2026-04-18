import type { RunLogEntry } from "../../state/sessionTypes";

export function RunLog({ entries }: { entries: RunLogEntry[] }) {
  return (
    <section className="panel-section">
      <p className="section-kicker">Run Log</p>
      <div className="run-log">
        {entries.length === 0 ? (
          <p className="empty-state">
            Workspace events will show up here as you open docs, Everlink selections, and place slices.
          </p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className={`run-log-entry run-log-entry--${entry.tone}`}>
              <div className="run-log-meta">
                <span>{entry.createdAt}</span>
                <span>{entry.tone}</span>
              </div>
              <p>{entry.message}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
