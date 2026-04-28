import type { HTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";
import styles from "./ModalShell.module.css";

type ModalShellProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function ModalShell({ children, className, ...props }: ModalShellProps) {
  return (
    <div
      className={classNames(styles.overlay, className)}
      role="dialog"
      aria-modal="true"
      {...props}
    >
      <div className={styles.card}>{children}</div>
    </div>
  );
}

export const modalShellStyles = styles;
