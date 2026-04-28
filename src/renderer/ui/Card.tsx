import type { HTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";
import styles from "./Card.module.css";

type CardStatus = "neutral" | "resolved" | "repaired" | "ambiguous" | "invalid";

type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  status?: CardStatus;
  variant?: "default" | "selection";
};

export function Card({
  children,
  className,
  status = "neutral",
  variant = "default",
  ...props
}: CardProps) {
  return (
    <article
      className={classNames(
        styles.card,
        variant === "selection" && styles.selection,
        status !== "neutral" && styles[status],
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export const cardStyles = styles;
