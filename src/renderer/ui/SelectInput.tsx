import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";

import { classNames } from "./classNames";
import styles from "./SelectInput.module.css";

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  variant?: "default" | "compact";
};

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={classNames(styles.select, variant !== "default" && styles[variant], className)}
      {...props}
    />
  );
});
