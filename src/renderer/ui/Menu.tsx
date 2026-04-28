import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { classNames } from "./classNames";
import styles from "./Menu.module.css";

type MenuProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Menu({ children, className, ...props }: MenuProps) {
  return (
    <div className={classNames(styles.menu, className)} {...props}>
      {children}
    </div>
  );
}

type MenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  danger?: boolean;
};

export function MenuItem({ className, danger, type = "button", ...props }: MenuItemProps) {
  return (
    <button
      className={classNames(styles.item, danger && styles.danger, className)}
      type={type}
      {...props}
    />
  );
}
