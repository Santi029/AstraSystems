import {
  exactVersion,
  recordedInstant,
  type AdminProjectData,
  type PersonName,
} from "./admin-view-model.ts";

/** Approved source versions only. No fallback to a working document or delivery snapshot. */
export type ApprovedReferenceRow = {
  key: string;
  documentId: string | null;
  title: string;
  version: string;
  content: string | null;
  responsible: string;
  ownerId: string | null;
  approvedAt: ReturnType<typeof recordedInstant>;
  updatedAt: ReturnType<typeof recordedInstant>;
  canOpen: boolean;
};
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;

export function approvedReferenceRows(
  p: AdminProjectData,
  personName?: PersonName,
): ApprovedReferenceRow[] {
  if (!Array.isArray(p.documents)) return [];
  return p.documents.flatMap((document, documentIndex) => {
    if (!record(document) || !Array.isArray(document.versions)) return [];
    const documentId = text(document.id);
    const ownerId = text(document.ownerId);
    const responsible = ownerId
      ? (text(personName?.(ownerId)) ?? ownerId)
      : "Not recorded";
    return document.versions.flatMap((entry, versionIndex) => {
      if (!record(entry) || entry.status !== "approved") return [];
      const version = exactVersion(entry.version);
      return [
        {
          key: documentIndex + ":" + versionIndex,
          documentId,
          title:
            text(document.title) ??
            (documentId
              ? "Document " + documentId
              : "Document title not recorded"),
          version: version ?? "Version not recorded",
          content: typeof entry.content === "string" ? entry.content : null,
          responsible,
          ownerId,
          approvedAt: recordedInstant(entry.approvedAt),
          updatedAt: recordedInstant(entry.savedAt),
          canOpen: documentId !== null && version !== null,
        },
      ];
    });
  });
}

export type ReferenceSelection = { project: AdminProjectData; key: string };
/** A refreshed/project-switched DTO invalidates an open selection instead of changing its source. */
export function selectedReferenceRow(
  p: AdminProjectData,
  rows: readonly ApprovedReferenceRow[],
  selection: ReferenceSelection | null,
): ApprovedReferenceRow | null {
  if (!selection || selection.project !== p) return null;
  return rows.find((row) => row.key === selection.key && row.canOpen) ?? null;
}

/** Search only the approved row title and responsible person, not hidden draft contents. */
export function filterApprovedReferences(
  rows: readonly ApprovedReferenceRow[],
  query: string,
): ApprovedReferenceRow[] {
  const search = query.trim().toLocaleLowerCase("en-US");
  return rows.filter(
    (row) =>
      !search ||
      [row.title, row.responsible, row.ownerId ?? ""].some((value) =>
        value.toLocaleLowerCase("en-US").includes(search),
      ),
  );
}
export function visibleApprovedReferences(
  rows: readonly ApprovedReferenceRow[],
  expanded: boolean,
): ApprovedReferenceRow[] {
  return expanded ? [...rows] : rows.slice(0, 5);
}

export type ReferenceSort = {
  column: "title" | "responsible" | "approvedAt" | "updatedAt";
  direction: "ascending" | "descending";
};
/** Local display sorting only; exact versions and source order remain untouched. */
export function sortApprovedReferences(
  rows: readonly ApprovedReferenceRow[],
  sort: ReferenceSort | null,
): ApprovedReferenceRow[] {
  if (!sort) return [...rows];
  const value = (row: ApprovedReferenceRow): string | number | null => {
    if (sort.column === "title") return row.title;
    if (sort.column === "responsible")
      return row.ownerId ? row.responsible : null;
    const iso = row[sort.column].iso;
    return iso ? Date.parse(iso) : null;
  };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const av = value(a.row),
        bv = value(b.row);
      if (av === null || bv === null) {
        if (av === bv) return a.index - b.index;
        return av === null ? 1 : -1;
      }
      const order =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "en-US", {
              numeric: true,
              sensitivity: "base",
            });
      return (
        (sort.direction === "descending" ? -order : order) || a.index - b.index
      );
    })
    .map(({ row }) => row);
}
