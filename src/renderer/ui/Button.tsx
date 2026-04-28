import type { ButtonHTMLAttributes } from "react";

import { classNames } from "./classNames";
import styles from "./Button.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "chip";
type ButtonTone = "default" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  tone?: ButtonTone;
  variant?: ButtonVariant;
};

export function Button({
  active,
  className,
  tone = "default",
  type = "button",
  variant = "ghost",
  ...props
}: ButtonProps) {
  return (
    <button
      className={classNames(
        styles.button,
        styles[variant],
        tone === "danger" && styles.danger,
        active && styles.chipActive,
        className,
      )}
      type={type}
      {...props}
    />
  );
}
