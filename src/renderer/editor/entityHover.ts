// Reports the entity highlight under the pointer. It only reports null when
// the pointer *leaves* an entity word: reporting null on every mousemove
// over plain text would keep restarting the preview's close timer, making
// the floating preview unreachable.

export type EntityHoverPayload = {
  entityId: string;
  clientX: number;
  clientY: number;
};

export function attachEntityHover(
  dom: HTMLElement,
  report: (payload: EntityHoverPayload | null) => void,
): () => void {
  let lastEntityId: string | null = null;

  const handleMouseMove = (event: MouseEvent) => {
    const target = event.target instanceof HTMLElement
      ? event.target.closest("[data-entity-id]") as HTMLElement | null
      : null;
    const entityId = target?.dataset.entityId ?? null;
    if (entityId) {
      lastEntityId = entityId;
      report({ entityId, clientX: event.clientX, clientY: event.clientY });
    } else if (lastEntityId !== null) {
      lastEntityId = null;
      report(null);
    }
  };

  const handleMouseLeave = () => {
    lastEntityId = null;
    report(null);
  };

  dom.addEventListener("mousemove", handleMouseMove);
  dom.addEventListener("mouseleave", handleMouseLeave);
  return () => {
    dom.removeEventListener("mousemove", handleMouseMove);
    dom.removeEventListener("mouseleave", handleMouseLeave);
  };
}
