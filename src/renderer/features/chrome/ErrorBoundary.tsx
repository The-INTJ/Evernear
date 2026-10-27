import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "../../ui";
import styles from "./ErrorBoundary.module.css";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

// Last line of defence: without a boundary React unmounts the whole tree
// on an uncaught render or effect error, which leaves a blank window. Saved
// prose is already in SQLite; this screen only has to get the author back.
// Highlights are the likeliest culprit, so one way back turns them off.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Evernear hit an error it could not recover from.", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <main className={styles.screen} role="alert">
        <h1>Evernear hit an error</h1>
        <p className={styles.message}>{error.message}</p>
        <p>Your saved writing is safe. Reload to keep going.</p>
        <div className={styles.actions}>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button variant="secondary" onClick={() => void reloadWithoutHighlights()}>
            Reload with highlights off
          </Button>
        </div>
      </main>
    );
  }
}

async function reloadWithoutHighlights(): Promise<void> {
  try {
    await window.evernear.updateLayout({ highlightsEnabled: false });
  } finally {
    window.location.reload();
  }
}
