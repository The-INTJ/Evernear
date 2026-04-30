import type { HTMLAttributes } from "react";

import { classNames } from "./classNames";
import styles from "./Swatch.module.css";

type SwatchProps = HTMLAttributes<HTMLSpanElement> & {
  index?: number;
  seed?: string;
};

export function Swatch({ className, index, seed, ...props }: SwatchProps) {
  const tone = typeof index === "number" ? index : swatchIndex(seed ?? "");
  return (
    <span
      aria-hidden="true"
      className={classNames(styles.swatch, styles[`tone${(tone % 4) + 1}`], className)}
      {...props}
    />
  );
}

function swatchIndex(value: string): number {
  return [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
