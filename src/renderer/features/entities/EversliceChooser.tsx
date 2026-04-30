// The FB-002 modal for binding a selection to an entity without leaving
// the current document. Renders a filterable list of entities (searching
// names + alias patterns + slice titles) plus an always-present
// "+ New entity" row at the bottom. Keyboard-driven: Arrow keys navigate,
// Enter commits, Escape closes. There is no backdrop-click dismiss — the
// frozen selection behind the modal makes an accidental dismiss worse
// than an explicit Cancel.
//
// No dedupe logic: entities are identified by GUID on the backend; name
// collisions are a future merge-entity problem. The caller may freely
// create a second "Gandalf" — that's a UX problem to solve with a merge
// flow, not a chooser hoist.

import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

import type { WorkspaceState } from "../../../shared/domain/workspace";
import { truncate } from "../../utils/formatting";
import {
  Button,
  Card,
  ModalShell,
  Swatch,
  TextInput,
  classNames,
  modalShellStyles,
} from "../../ui";
import styles from "./EversliceChooser.module.css";

const MAX_ROWS = 50;

type Props = {
  isOpen: boolean;
  sourceText: string;
  workspace: WorkspaceState | null;
  onClose: () => void;
  onConfirmExisting: (entityId: string) => void;
  onConfirmNew: (name: string) => void;
};

type EntityRow = { kind: "entity"; id: string; name: string; index: number };
type CreateRow = { kind: "create"; name: string };
type Row = EntityRow | CreateRow;

export function EversliceChooser(props: Props) {
  const { isOpen, sourceText, workspace, onClose, onConfirmExisting, onConfirmNew } = props;
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset + focus each time the modal opens so a previous session's
  // query/highlight doesn't flash on reopen.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const entityRows = useMemo<EntityRow[]>(() => {
    if (!workspace) return [];
    const trimmedQuery = query.trim().toLowerCase();

    if (trimmedQuery === "") {
      return workspace.entities
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, MAX_ROWS)
        .map((entity, index) => ({ kind: "entity", id: entity.id, name: entity.name, index }));
    }

    // Build per-entity alias and slice-title lookups once so the filter
    // below is O(entities) instead of O(entities * rules).
    const rulesByEntity = new Map<string, string[]>();
    for (const rule of workspace.matchingRules) {
      const bucket = rulesByEntity.get(rule.entityId) ?? [];
      bucket.push(rule.pattern.toLowerCase(), rule.label.toLowerCase());
      rulesByEntity.set(rule.entityId, bucket);
    }

    const sliceTitleById = new Map(
      workspace.slices.map((slice) => [slice.id, slice.title.toLowerCase()]),
    );
    const titlesByEntity = new Map<string, string[]>();
    for (const link of workspace.entitySlices) {
      const title = sliceTitleById.get(link.sliceId);
      if (!title) continue;
      const bucket = titlesByEntity.get(link.entityId) ?? [];
      bucket.push(title);
      titlesByEntity.set(link.entityId, bucket);
    }

    const matched = workspace.entities.filter((entity) => {
      if (entity.name.toLowerCase().includes(trimmedQuery)) return true;
      const ruleTerms = rulesByEntity.get(entity.id);
      if (ruleTerms?.some((term) => term.includes(trimmedQuery))) return true;
      const sliceTitles = titlesByEntity.get(entity.id);
      if (sliceTitles?.some((title) => title.includes(trimmedQuery))) return true;
      return false;
    });

    return matched
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS)
      .map((entity, index) => ({ kind: "entity", id: entity.id, name: entity.name, index }));
  }, [workspace, query]);

  const rows = useMemo<Row[]>(() => {
    const createRow: CreateRow = { kind: "create", name: query.trim() };
    return [...entityRows, createRow];
  }, [entityRows, query]);

  // A shrinking list must never leave highlightIndex pointing past the end.
  useEffect(() => {
    setHighlightIndex((current) => {
      if (rows.length === 0) return 0;
      return Math.min(current, rows.length - 1);
    });
  }, [rows.length]);

  const commit = (row: Row) => {
    if (row.kind === "entity") {
      onConfirmExisting(row.id);
      return;
    }
    const trimmed = row.name.trim();
    if (!trimmed) return;
    onConfirmNew(trimmed);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => Math.min(current + 1, rows.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[highlightIndex];
      if (row) commit(row);
    }
  };

  if (!isOpen) return null;

  return (
    <ModalShell>
      <header className={modalShellStyles.header}>
        <span className={styles.kicker}>Everslice it!</span>
        <h2>Bind selection to an entity</h2>
      </header>
      <Card variant="selection">
        <strong>Selected text</strong>
        <span>{truncate(sourceText, 240)}</span>
      </Card>
      <TextInput
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search entities by name, alias, or slice title..."
      />
      <ul className={styles.list} role="listbox">
        {entityRows.length === 0 && query.trim().length > 0 ? (
          <li className={styles.empty}>
            No matches. Press Enter on the row below to create a new entity.
          </li>
        ) : null}
        {rows.map((row, index) => {
          const isHighlighted = index === highlightIndex;
          if (row.kind === "entity") {
            return (
              <li
                key={row.id}
                className={rowClass(isHighlighted, "entity")}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => commit(row)}
                role="option"
                aria-selected={isHighlighted}
              >
                <Swatch index={row.index} />
                <span className={styles.rowName}>{row.name}</span>
              </li>
            );
          }
          const createDisabled = row.name.length === 0;
          return (
            <li
              key="__create__"
              className={rowClass(isHighlighted, "create", createDisabled)}
              onMouseEnter={() => {
                if (!createDisabled) setHighlightIndex(index);
              }}
              onClick={() => {
                if (!createDisabled) commit(row);
              }}
              role="option"
              aria-selected={isHighlighted}
              aria-disabled={createDisabled}
            >
              <span className={styles.rowName}>
                {createDisabled
                  ? "+ New entity (type a name above)"
                  : `+ New entity: "${row.name}"`}
              </span>
            </li>
          );
        })}
      </ul>
      <div className={styles.actions}>
        <span className={styles.hints}>
          <kbd>Up/Down</kbd> navigate <kbd>Enter</kbd> bind <kbd>Esc</kbd> close
        </span>
        <Button variant="secondary" size="compact" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </ModalShell>
  );
}

function rowClass(
  isHighlighted: boolean,
  variant: "entity" | "create",
  disabled?: boolean,
): string {
  return classNames(
    styles.row,
    variant === "create" && styles.rowCreate,
    isHighlighted && styles.rowHighlight,
    disabled && styles.rowDisabled,
  );
}
