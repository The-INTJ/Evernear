import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import type { EntityRecord } from "../../../shared/domain/workspace";
import type { HoverPreview as HoverPreviewState } from "../../state/sessionTypes";
import type { ResolvedSliceView } from "../../utils/workspace";
import { classNames } from "../../ui";
import styles from "./HoverPreview.module.css";

const POINTER_GAP_PX = 12;
const VIEWPORT_MARGIN_PX = 24;

type Props = {
  hover: HoverPreviewState;
  entity: EntityRecord | null;
  slices: ResolvedSliceView[];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onOpenSlice: (sliceId: string) => void;
  onOpenEntity: (entityId: string) => void;
};

export function HoverPreview({
  hover,
  entity,
  slices,
  onMouseEnter,
  onMouseLeave,
  onOpenSlice,
  onOpenEntity,
}: Props) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(() => initialPreviewPosition(hover));

  useLayoutEffect(() => {
    if (!entity) return;

    const preview = previewRef.current;
    if (!preview) return;

    const updatePosition = () => {
      const rect = preview.getBoundingClientRect();
      const nextPosition = getPreviewPosition(
        hover,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight },
      );

      setPosition((current) =>
        current.left === nextPosition.left && current.top === nextPosition.top
          ? current
          : nextPosition,
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(preview);

    return () => {
      window.removeEventListener("resize", updatePosition);
      resizeObserver.disconnect();
    };
  }, [entity, hover]);

  if (!entity) return null;

  const style: CSSProperties = {
    left: position.left,
    top: position.top,
  };

  return (
    <div
      ref={previewRef}
      className={styles.preview}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        className={styles.entityName}
        type="button"
        title="Edit this entity"
        onClick={() => onOpenEntity(entity.id)}
      >
        {entity.name}
      </button>
      {slices.length === 0 ? (
        <p className={styles.empty}>No slices yet. Select a passage and choose Add slice.</p>
      ) : (
        <ul className={styles.slices}>
          {slices.map(({ slice, boundary, document }) => {
            const status = boundary?.resolution.status;
            const lost = !boundary || status === "invalid" || status === "ambiguous";
            return (
              <li key={slice.id}>
                <button
                  className={classNames(styles.slice, lost && styles.lost)}
                  type="button"
                  onClick={() => onOpenSlice(slice.id)}
                >
                  <span className={styles.document}>
                    {document?.title ?? "Document"}
                    {lost ? " · text not found" : ""}
                  </span>
                  <span className={styles.text}>{boundary?.resolution.anchor.exact ?? slice.excerpt}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

type PreviewSize = {
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type PreviewPosition = {
  left: number;
  top: number;
};

function initialPreviewPosition(hover: HoverPreviewState): PreviewPosition {
  return {
    left: hover.x + POINTER_GAP_PX,
    top: hover.y + POINTER_GAP_PX,
  };
}

function getPreviewPosition(
  hover: HoverPreviewState,
  preview: PreviewSize,
  viewport: ViewportSize,
): PreviewPosition {
  const maxLeft = Math.max(VIEWPORT_MARGIN_PX, viewport.width - preview.width - VIEWPORT_MARGIN_PX);
  const left = clamp(hover.x + POINTER_GAP_PX, VIEWPORT_MARGIN_PX, maxLeft);

  const preferredBelowTop = hover.y + POINTER_GAP_PX;
  const bottomLimit = viewport.height - VIEWPORT_MARGIN_PX;

  if (preferredBelowTop + preview.height <= bottomLimit) {
    return {
      left: Math.round(left),
      top: Math.round(preferredBelowTop),
    };
  }

  const preferredAboveTop = hover.y - preview.height - POINTER_GAP_PX;
  const maxTop = Math.max(
    VIEWPORT_MARGIN_PX,
    viewport.height - preview.height - VIEWPORT_MARGIN_PX,
  );
  const top =
    preferredAboveTop >= VIEWPORT_MARGIN_PX
      ? preferredAboveTop
      : clamp(preferredBelowTop, VIEWPORT_MARGIN_PX, maxTop);

  return {
    left: Math.round(left),
    top: Math.round(top),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
