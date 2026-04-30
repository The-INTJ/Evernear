// Pure helpers that turn the flat folder + document lists from
// WorkspaceState into a tree shape the renderer can recurse over.
// Stateless and memoizable — no side effects, no IPC.

import { useMemo } from "react";

import type {
  DocumentFolderRecord,
  DocumentSummary,
} from "../../../../shared/domain/workspace";

export type NavTreeStructure = {
  rootFolders: DocumentFolderRecord[];
  childrenByParentId: Map<string, DocumentFolderRecord[]>;
  documentsByFolderId: Map<string | null, DocumentSummary[]>;
  documentsById: Map<string, DocumentSummary>;
  foldersById: Map<string, DocumentFolderRecord>;
  // Closure of self + all transitive descendants for cycle prevention
  // during a folder drag. Indexed by source folder id.
  descendantsByFolderId: Map<string, Set<string>>;
};

export function useNavTreeStructure(
  folders: DocumentFolderRecord[],
  documents: DocumentSummary[],
): NavTreeStructure {
  return useMemo(() => {
    const childrenByParentId = new Map<string, DocumentFolderRecord[]>();
    const foldersById = new Map<string, DocumentFolderRecord>();
    const rootFolders: DocumentFolderRecord[] = [];

    for (const folder of folders) {
      foldersById.set(folder.id, folder);
      if (folder.parentFolderId === null) {
        rootFolders.push(folder);
      } else {
        const list = childrenByParentId.get(folder.parentFolderId) ?? [];
        list.push(folder);
        childrenByParentId.set(folder.parentFolderId, list);
      }
    }

    const documentsByFolderId = new Map<string | null, DocumentSummary[]>();
    const documentsById = new Map<string, DocumentSummary>();
    for (const document of documents) {
      documentsById.set(document.id, document);
      const list = documentsByFolderId.get(document.folderId) ?? [];
      list.push(document);
      documentsByFolderId.set(document.folderId, list);
    }

    const descendantsByFolderId = new Map<string, Set<string>>();
    for (const folder of folders) {
      const acc = new Set<string>([folder.id]);
      const stack = [folder.id];
      while (stack.length > 0) {
        const next = stack.pop()!;
        for (const child of childrenByParentId.get(next) ?? []) {
          if (!acc.has(child.id)) {
            acc.add(child.id);
            stack.push(child.id);
          }
        }
      }
      descendantsByFolderId.set(folder.id, acc);
    }

    return {
      rootFolders,
      childrenByParentId,
      documentsByFolderId,
      documentsById,
      foldersById,
      descendantsByFolderId,
    };
  }, [folders, documents]);
}
