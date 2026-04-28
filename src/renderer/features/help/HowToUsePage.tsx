import { useEffect } from "react";

import { Button, classNames } from "../../ui";
import styles from "./HowToUsePage.module.css";

type Props = {
  onBackToWorkspace: () => void;
};

const shortcuts = [
  ["Ctrl/Cmd+B", "Bold selected text or keep typing in bold."],
  ["Ctrl/Cmd+I", "Italicize selected text or keep typing in italics."],
  ["Ctrl/Cmd+Z", "Undo the last prose edit."],
  ["Ctrl/Cmd+Y", "Redo an edit."],
  ["Ctrl/Cmd+Shift+Z", "Redo on keyboards that use the alternate redo chord."],
  ["Ctrl/Cmd+A", "Select the whole document."],
  ["Ctrl/Cmd+C", "Copy clean prose without Evernear highlights."],
  ["Arrow keys", "Move through chooser results."],
  ["Enter", "Confirm the highlighted chooser row."],
  ["Escape", "Close a chooser, menu, or this page."],
];

const workflows = [
  {
    title: "Write With Context",
    body: "Keep writing in the editor. Entity highlights are derived live from matching rules, so the prose stays clean.",
  },
  {
    title: "Use A Selection",
    body: "Select text to reveal nearby actions for Bold, Italic, Everlink, and Everslice. The same actions also live in the Evernear window bar.",
  },
  {
    title: "Use A Highlight",
    body: "Hover an entity highlight to preview linked slices. Click or right-click a highlight to open its persistent context.",
  },
  {
    title: "Pin Context",
    body: "Open related slices in the side panel when you want reference material to stay visible while you continue drafting.",
  },
];

export function HowToUsePage({ onBackToWorkspace }: Props) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onBackToWorkspace();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBackToWorkspace]);

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.kicker}>Shortcuts</span>
          <h1>How to Use Evernear</h1>
          <p>
            The window bar holds global commands. The editor keeps the actions that belong to
            selected words and entity highlights close to the prose.
          </p>
        </div>
        <Button className={styles.heroButton} variant="primary" onClick={onBackToWorkspace}>
          Back to Workspace
        </Button>
      </section>

      <section className={styles.grid} aria-label="Main workflows">
        {workflows.map((item) => (
          <article className={styles.card} key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Keyboard</span>
          <h2>Shortcuts</h2>
        </div>
        <div className={styles.shortcutGrid}>
          {shortcuts.map(([keys, description]) => (
            <article className={styles.shortcutRow} key={keys}>
              <kbd>{keys}</kbd>
              <span>{description}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={classNames(styles.section, styles.sectionCompact)}>
        <div className={styles.sectionHeading}>
          <span className={styles.kicker}>Mouse</span>
          <h2>Selection and Right Click</h2>
        </div>
        <p>
          Select text for the floating action bubble. Right-click selected text for the same actions
          plus copy and select all. Right-click an entity highlight to select or open that entity's
          context.
        </p>
      </section>
    </main>
  );
}
