import type { HTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";
import styles from "./PanelSection.module.css";

type PanelSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  grow?: boolean;
  kicker?: string;
  project?: boolean;
};

export function PanelSection({
  children,
  className,
  grow,
  kicker,
  project,
  ...props
}: PanelSectionProps) {
  return (
    <section
      className={classNames(
        styles.section,
        grow && styles.grow,
        project && styles.project,
        className,
      )}
      {...props}
    >
      {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
      {children}
    </section>
  );
}
