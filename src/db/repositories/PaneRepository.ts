import type {
  CreatePaneInput,
  DocumentSummary,
  EntityRecord,
  MovePaneInput,
  PanePlacement,
  PopPaneContentInput,
  PushPaneContentInput,
  ReplacePaneContentInput,
  UpdatePaneInput,
  WorkspaceLayoutState,
  WorkspacePane,
} from "../../shared/domain/workspace";
import type { SqliteHarness } from "../sqliteHarness";
import { isoNow } from "../utils";
import { mapWorkspacePaneRow } from "../rowMappers";
import type { RawWorkspacePaneRow } from "../rowTypes";

export class PaneRepository {
  constructor(private readonly sqlite: SqliteHarness) {}

  loadPanes(projectId: string): WorkspacePane[] {
    const rows = this.sqlite.getConnection().prepare(`
      SELECT
        id,
        project_id,
        title,
        content_json,
        placement_json,
        history_json,
        created_at,
        updated_at
      FROM workspace_panes
      WHERE project_id = ?
      ORDER BY updated_at ASC
    `).all(projectId) as RawWorkspacePaneRow[];

    return rows.map(mapWorkspacePaneRow);
  }

  ensureProjectPanes(
    projectId: string,
    layout: WorkspaceLayoutState,
    documents: DocumentSummary[],
    entities: EntityRecord[],
  ): WorkspacePane[] {
    const existing = this.loadPanes(projectId);
    if (existing.length > 0) {
      return existing;
    }

    const now = isoNow();
    const activeDocumentId = layout.activeDocumentId ?? documents[0]?.id ?? null;

    this.insertPane({
      id: defaultProjectNavPaneId(projectId),
      projectId,
      title: "Projects",
      content: { kind: "projectNav" },
      placement: {
        kind: "docked",
        region: "left",
        stackId: "left",
        order: 0,
      },
      history: [],
      createdAt: now,
      updatedAt: now,
    });

    if (activeDocumentId) {
      const document = documents.find((candidate) => candidate.id === activeDocumentId);
      this.insertPane({
        id: defaultDocumentPaneId(projectId, activeDocumentId),
        projectId,
        title: document?.title ?? "Document",
        content: { kind: "document", documentId: activeDocumentId },
        placement: {
          kind: "workspace",
          rect: { x: 300, y: 96, width: 860, height: 760 },
          zIndex: 1,
        },
        history: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    const selectedEntityId = layout.selectedEntityId ?? entities[0]?.id ?? null;
    if (selectedEntityId) {
      const entity = entities.find((candidate) => candidate.id === selectedEntityId);
      this.insertPane({
        id: defaultEntityPaneId(projectId, selectedEntityId),
        projectId,
        title: entity?.name ?? "Entity Slices",
        content: { kind: "entitySlices", entityId: selectedEntityId },
        placement: {
          kind: "docked",
          region: "right",
          stackId: "right",
          order: 0,
        },
        history: [],
        createdAt: now,
        updatedAt: now,
      });
    }

    return this.loadPanes(projectId);
  }

  createPane(input: CreatePaneInput, paneId: string, fallbackProjectId: string, title: string): WorkspacePane {
    const panes = this.loadPanes(input.projectId ?? fallbackProjectId);
    const now = isoNow();
    const projectId = input.projectId ?? fallbackProjectId;
    const pane: WorkspacePane = {
      id: paneId,
      projectId,
      title: input.title ?? title,
      content: input.content,
      placement: input.placement ?? defaultFloatingPlacement(panes),
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    this.insertPane(pane);
    return pane;
  }

  updatePane(input: UpdatePaneInput): WorkspacePane {
    const current = this.requirePane(input.paneId);
    const pane: WorkspacePane = {
      ...current,
      title: input.title ?? current.title,
      content: input.content ?? current.content,
      placement: input.placement ?? current.placement,
      history: input.history ?? current.history,
      updatedAt: isoNow(),
    };
    this.savePane(pane);
    return pane;
  }

  closePane(paneId: string): WorkspacePane | null {
    const pane = this.loadPane(paneId);
    if (!pane) return null;

    this.sqlite.getConnection().prepare("DELETE FROM workspace_panes WHERE id = ?").run(paneId);
    return pane;
  }

  movePane(input: MovePaneInput): WorkspacePane {
    return this.updatePane({ paneId: input.paneId, placement: input.placement });
  }

  replacePaneContent(input: ReplacePaneContentInput, title: string): WorkspacePane {
    return this.updatePane({
      paneId: input.paneId,
      content: input.content,
      title: input.title ?? title,
    });
  }

  pushPaneContent(input: PushPaneContentInput, title: string): WorkspacePane {
    const current = this.requirePane(input.paneId);
    return this.updatePane({
      paneId: input.paneId,
      content: input.content,
      title: input.title ?? title,
      history: [...current.history, current.content],
    });
  }

  popPaneContent(input: PopPaneContentInput, title: string): WorkspacePane {
    const current = this.requirePane(input.paneId);
    const content = current.history.at(-1);
    if (!content) return current;

    return this.updatePane({
      paneId: input.paneId,
      content,
      title,
      history: current.history.slice(0, -1),
    });
  }

  loadPane(paneId: string): WorkspacePane | null {
    const row = this.sqlite.getConnection().prepare(`
      SELECT
        id,
        project_id,
        title,
        content_json,
        placement_json,
        history_json,
        created_at,
        updated_at
      FROM workspace_panes
      WHERE id = ?
    `).get(paneId) as RawWorkspacePaneRow | undefined;

    return row ? mapWorkspacePaneRow(row) : null;
  }

  requirePane(paneId: string): WorkspacePane {
    const pane = this.loadPane(paneId);
    if (!pane) {
      throw new Error(`Missing pane ${paneId}.`);
    }
    return pane;
  }

  private insertPane(pane: WorkspacePane): void {
    this.sqlite.getConnection().prepare(`
      INSERT INTO workspace_panes (
        id,
        project_id,
        title,
        content_json,
        placement_json,
        history_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      pane.id,
      pane.projectId,
      pane.title,
      JSON.stringify(pane.content),
      JSON.stringify(pane.placement),
      JSON.stringify(pane.history),
      pane.createdAt,
      pane.updatedAt,
    );
  }

  private savePane(pane: WorkspacePane): void {
    this.sqlite.getConnection().prepare(`
      UPDATE workspace_panes
      SET
        title = ?,
        content_json = ?,
        placement_json = ?,
        history_json = ?,
        updated_at = ?
      WHERE id = ?
    `).run(
      pane.title,
      JSON.stringify(pane.content),
      JSON.stringify(pane.placement),
      JSON.stringify(pane.history),
      pane.updatedAt,
      pane.id,
    );
  }
}

function defaultProjectNavPaneId(projectId: string): string {
  return `${projectId}:pane:project-nav`;
}

function defaultDocumentPaneId(projectId: string, documentId: string): string {
  return `${projectId}:pane:document:${documentId}`;
}

function defaultEntityPaneId(projectId: string, entityId: string): string {
  return `${projectId}:pane:entity:${entityId}`;
}

function defaultFloatingPlacement(panes: WorkspacePane[]): PanePlacement {
  const workspacePanes = panes.filter((pane) => pane.placement.kind === "workspace");
  const zIndex = workspacePanes.reduce((max, pane) => (
    pane.placement.kind === "workspace" ? Math.max(max, pane.placement.zIndex) : max
  ), 1) + 1;
  const offset = Math.min(160, workspacePanes.length * 28);
  return {
    kind: "workspace",
    rect: { x: 340 + offset, y: 120 + offset, width: 520, height: 560 },
    zIndex,
  };
}
