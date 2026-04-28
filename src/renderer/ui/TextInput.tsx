import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

import { classNames } from "./classNames";
import styles from "./TextInput.module.css";

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  variant?: "default" | "project" | "title";
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={classNames(styles.input, variant !== "default" && styles[variant], className)}
      {...props}
    />
  );
});
