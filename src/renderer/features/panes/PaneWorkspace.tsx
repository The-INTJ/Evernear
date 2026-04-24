import type { ReactNode } from "react";
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import type {
  PanePlacement,
  Rect,
  WorkspacePane,
} from "../../../shared/domain/workspace";

type Props = {
  panes: WorkspacePane[];
  focusedPaneId: string | null;
  renderPane: (pane: WorkspacePane) => ReactNode;
  onFocusPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onBackPane: (paneId: string) => void;
  onPopOutPane: (paneId: string) => void;
  onMovePane: (paneId: string, placement: PanePlacement) => void;
};

type DragState = {
  paneId: string;
  startX: number;
  startY: number;
  startRect: Rect;
  mode: "move" | "resize";
};

export function PaneWorkspace({
  panes,
  focusedPaneId,
  renderPane,
  onFocusPane,
  onClosePane,
  onBackPane,
  onPopOutPane,
  onMovePane,
}: Props) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [placementOverrides, setPlacementOverrides] = useState<Record<string, PanePlacement>>({});

  const effectivePanes = useMemo(() => panes.map((pane) => ({
    ...pane,
    placement: placementOverrides[pane.id] ?? pane.placement,
  })), [panes, placementOverrides]);

  const dockedLeft = effectivePanes.filter((pane) => pane.placement.kind === "docked" && pane.placement.region === "left")
    .sort(compareDockOrder);
  const dockedRight = effectivePanes.filter((pane) => pane.placement.kind === "docked" && pane.placement.region === "right")
    .sort(compareDockOrder);
  const dockedBottom = effectivePanes.filter((pane) => pane.placement.kind === "docked" && pane.placement.region === "bottom")
    .sort(compareDockOrder);
  const floating = effectivePanes.filter((pane) => pane.placement.kind === "workspace")
    .sort((a, b) => workspaceZIndex(a.placement) - workspaceZIndex(b.placement));

  const startDrag = useCallback((pane: WorkspacePane, event: ReactPointerEvent, mode: "move" | "resize") => {
    if (pane.placement.kind !== "workspace") return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onFocusPane(pane.id);
    setDragState({
      paneId: pane.id,
      startX: event.clientX,
      startY: event.clientY,
      startRect: pane.placement.rect,
      mode,
    });
  }, [onFocusPane]);

  const handlePointerMove = useCallback((event: ReactPointerEvent) => {
    if (!dragState) return;
    const pane = effectivePanes.find((candidate) => candidate.id === dragState.paneId);
    if (!pane || pane.placement.kind !== "workspace") return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const rect = dragState.mode === "move"
      ? {
          ...dragState.startRect,
          x: dragState.startRect.x + deltaX,
          y: dragState.startRect.y + deltaY,
        }
      : {
          ...dragState.startRect,
          width: Math.max(320, dragState.startRect.width + deltaX),
          height: Math.max(260, dragState.startRect.height + deltaY),
        };

    setPlacementOverrides((current) => ({
      ...current,
      [dragState.paneId]: {
        ...pane.placement,
        rect,
      },
    }));
  }, [dragState, effectivePanes]);

  const finishDrag = useCallback(() => {
    if (!dragState) return;
    const placement = placementOverrides[dragState.paneId];
    if (placement) {
      onMovePane(dragState.paneId, placement);
    }
    setDragState(null);
    setPlacementOverrides((current) => {
      const next = { ...current };
      delete next[dragState.paneId];
      return next;
    });
  }, [dragState, onMovePane, placementOverrides]);

  return (
    <main
      className="pane-workspace"
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <DockRegion panes={dockedLeft} focusedPaneId={focusedPaneId} region="left" renderPane={renderPane} onFocusPane={onFocusPane} onClosePane={onClosePane} onBackPane={onBackPane} onPopOutPane={onPopOutPane} />
      <section className="pane-workspace__center">
        <div className="pane-workspace__canvas">
          {floating.map((pane) => (
            <article
              key={pane.id}
              className={paneClassName(pane, focusedPaneId)}
              style={floatingPaneStyle(pane.placement)}
              onMouseDown={() => onFocusPane(pane.id)}
            >
              <PaneChrome
                pane={pane}
                focused={pane.id === focusedPaneId}
                onBackPane={onBackPane}
                onClosePane={onClosePane}
                onPopOutPane={onPopOutPane}
                onDragStart={(event) => startDrag(pane, event, "move")}
              />
              <div className="workspace-pane__body">{renderPane(pane)}</div>
              <button
                className="workspace-pane__resize"
                type="button"
                aria-label={`Resize ${pane.title}`}
                onPointerDown={(event) => startDrag(pane, event, "resize")}
              />
            </article>
          ))}
        </div>
      <DockRegion panes={dockedBottom} focusedPaneId={focusedPaneId} region="bottom" renderPane={renderPane} onFocusPane={onFocusPane} onClosePane={onClosePane} onBackPane={onBackPane} onPopOutPane={onPopOutPane} />
      </section>
      <DockRegion panes={dockedRight} focusedPaneId={focusedPaneId} region="right" renderPane={renderPane} onFocusPane={onFocusPane} onClosePane={onClosePane} onBackPane={onBackPane} onPopOutPane={onPopOutPane} />
    </main>
  );
}

type DockRegionProps = {
  panes: WorkspacePane[];
  focusedPaneId: string | null;
  region: "left" | "right" | "bottom";
  renderPane: (pane: WorkspacePane) => ReactNode;
  onFocusPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onBackPane: (paneId: string) => void;
  onPopOutPane: (paneId: string) => void;
};

function DockRegion({ panes, focusedPaneId, region, renderPane, onFocusPane, onClosePane, onBackPane, onPopOutPane }: DockRegionProps) {
  if (panes.length === 0) {
    return <aside className={`pane-dock pane-dock--${region} pane-dock--empty`} />;
  }

  return (
    <aside className={`pane-dock pane-dock--${region}`}>
      {panes.map((pane) => (
        <article
          key={pane.id}
          className={paneClassName(pane, focusedPaneId)}
          onMouseDown={() => onFocusPane(pane.id)}
        >
          <PaneChrome
            pane={pane}
            focused={pane.id === focusedPaneId}
            onBackPane={onBackPane}
            onClosePane={onClosePane}
            onPopOutPane={onPopOutPane}
          />
          <div className="workspace-pane__body">{renderPane(pane)}</div>
        </article>
      ))}
    </aside>
  );
}

type PaneChromeProps = {
  pane: WorkspacePane;
  focused: boolean;
  onBackPane: (paneId: string) => void;
  onClosePane: (paneId: string) => void;
  onPopOutPane: (paneId: string) => void;
  onDragStart?: (event: ReactPointerEvent) => void;
};

function PaneChrome({ pane, focused, onBackPane, onClosePane, onPopOutPane, onDragStart }: PaneChromeProps) {
  return (
    <header className={focused ? "workspace-pane__chrome workspace-pane__chrome--focused" : "workspace-pane__chrome"}>
      <button
        className="pane-icon-button pane-icon-button--drag"
        type="button"
        aria-label={`Move ${pane.title}`}
        onPointerDown={onDragStart}
      >
        ::
      </button>
      <strong>{pane.title}</strong>
      <div className="workspace-pane__commands">
        <button
          className="pane-icon-button"
          type="button"
          disabled={pane.history.length === 0}
          onClick={() => onBackPane(pane.id)}
          aria-label={`Back in ${pane.title}`}
        >
          {"<"}
        </button>
        <button
          className="pane-icon-button"
          type="button"
          aria-label={`Pop out ${pane.title}`}
          onClick={() => onPopOutPane(pane.id)}
        >
          []
        </button>
        <button
          className="pane-icon-button"
          type="button"
          onClick={() => onClosePane(pane.id)}
          aria-label={`Close ${pane.title}`}
        >
          x
        </button>
      </div>
    </header>
  );
}

function compareDockOrder(a: WorkspacePane, b: WorkspacePane): number {
  const aOrder = a.placement.kind === "docked" ? a.placement.order : 0;
  const bOrder = b.placement.kind === "docked" ? b.placement.order : 0;
  return aOrder - bOrder;
}

function paneClassName(pane: WorkspacePane, focusedPaneId: string | null): string {
  return pane.id === focusedPaneId
    ? "workspace-pane workspace-pane--focused"
    : "workspace-pane";
}

function workspaceZIndex(placement: PanePlacement): number {
  return placement.kind === "workspace" ? placement.zIndex : 0;
}

function floatingPaneStyle(placement: PanePlacement): CSSProperties {
  if (placement.kind !== "workspace") return {};
  return {
    left: placement.rect.x,
    top: placement.rect.y,
    width: placement.rect.width,
    height: placement.rect.height,
    zIndex: placement.zIndex,
  };
}
