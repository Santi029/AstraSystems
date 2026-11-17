import {
  exactVersion,
  type AdminProjectData,
  type AdminSourceRecord,
  type PersonName,
} from "./admin-view-model.ts";

const record = (value: unknown): value is AdminSourceRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const validActor = (actorId: unknown): actorId is string =>
  text(actorId) !== null;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const MY_TASK_PAGE_SIZES = [6, 12, 24] as const;
export type MyTaskStatus = {
  key: string;
  label: string;
  tone: "neutral" | "info" | "success" | "warning" | "error";
};
const STATUS_LABELS: Readonly<
  Record<string, Pick<MyTaskStatus, "label" | "tone">>
> = Object.freeze({
  available: { label: "Available", tone: "neutral" },
  active: { label: "Active", tone: "info" },
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  complete: { label: "Complete", tone: "success" },
  completed: { label: "Complete", tone: "success" },
  blocked: { label: "Blocked", tone: "warning" },
  stopped: { label: "Stopped", tone: "error" },
});
/** The recorded status wins; false/missing completion never implies active or not started. */
export function myTaskStatus(task: AdminSourceRecord): MyTaskStatus {
  const raw = text(task.status);
  if (raw) {
    const known = Object.hasOwn(STATUS_LABELS, raw) ? STATUS_LABELS[raw] : null;
    return {
      key: "status:" + (raw === "completed" ? "complete" : raw),
      label: known?.label ?? "Recorded: " + raw,
      tone: known?.tone ?? "neutral",
    };
  }
  return task.completed === true
    ? { key: "status:complete", label: "Complete", tone: "success" }
    : { key: "unknown", label: "Unknown", tone: "neutral" };
}
export type MyTaskRow = {
  key: string;
  id: string | null;
  title: string;
  description: string | null;
  ownerId: string;
  responsible: string;
  status: MyTaskStatus;
  canOpen: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  exampleDates?: boolean;
};

/** No role, assignee alias, project Admin privilege or work-selection list broadens ownership. */
export function ownTaskRows(
  p: AdminProjectData,
  actorId: string,
  personName?: PersonName,
): MyTaskRow[] {
  if (!validActor(actorId)) return [];
  const tasks = list(p.tasks);
  const counts = new Map<string, number>();
  for (const task of tasks) {
    const id = record(task) ? text(task.id) : null;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return tasks.flatMap((task, index) => {
    if (!record(task) || task.ownerId !== actorId) return [];
    const id = text(task.id);
    return [
      {
        key: (id ?? "missing") + ":" + index,
        id,
        title: text(task.title) ?? "Task title not recorded",
        description: text(task.description),
        ownerId: actorId,
        responsible: text(personName?.(actorId)) ?? actorId,
        status: myTaskStatus(task),
        createdAt: text(task.createdAt),
        updatedAt: text(task.updatedAt),
        exampleDates: task.exampleDates === true,
        canOpen: id !== null && counts.get(id) === 1,
      },
    ];
  });
}
export function myTaskStatusOptions(rows: readonly MyTaskRow[]) {
  const options = new Map<string, string>();
  for (const row of rows) options.set(row.status.key, row.status.label);
  return [
    { key: "all", label: "All" },
    ...[...options].map(([key, label]) => ({ key, label })),
  ];
}
export function filterMyTasks(
  rows: readonly MyTaskRow[],
  query: string,
  status = "all",
): MyTaskRow[] {
  const search = query.trim().toLocaleLowerCase("en-US");
  return rows.filter(
    (row) =>
      (status === "all" || row.status.key === status) &&
      (!search || row.title.toLocaleLowerCase("en-US").includes(search)),
  );
}
export function paginateMyTasks(
  rows: readonly MyTaskRow[],
  requestedPage = 1,
  requestedSize = 6,
) {
  const pageSize = MY_TASK_PAGE_SIZES.includes(requestedSize as 6 | 12 | 24)
    ? requestedSize
    : 6;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Number.isSafeInteger(requestedPage)
    ? Math.min(pageCount, Math.max(1, requestedPage))
    : 1;
  const offset = (page - 1) * pageSize;
  return {
    rows: rows.slice(offset, offset + pageSize),
    page,
    pageSize,
    pageCount,
    total: rows.length,
    from: rows.length ? offset + 1 : 0,
    to: Math.min(offset + pageSize, rows.length),
    hasPrevious: page > 1,
    hasNext: page < pageCount,
  };
}
/** Recognize only explicit SRS task names, not documents, other owners or inferred assignments. */
export function shouldRecommendSrs(
  p: AdminProjectData,
  actorId: string,
): boolean {
  if (!validActor(actorId) || !Array.isArray(p.tasks)) return false;
  return !ownTaskRows(p, actorId).some((row) =>
    /^(?:srs|software requirements specification(?:\s*\(srs\))?)$/i.test(
      row.title.trim().replace(/\s+/g, " "),
    ),
  );
}
export type MyTaskDocument = {
  key: string;
  title: string;
  versions: {
    key: string;
    version: string;
    status: string;
    content: string | null;
  }[];
};
/** Resolve the task again before projecting any document, never trust a caller-supplied row. */
export function ownTaskDetail(
  p: AdminProjectData,
  actorId: string,
  key: string,
  personName?: PersonName,
): {
  task: MyTaskRow;
  documents: MyTaskDocument[];
  documentsAvailable: boolean;
} | null {
  const task = ownTaskRows(p, actorId, personName).find(
    (row) => row.key === key && row.canOpen,
  );
  if (!task) return null;
  const documents = list(p.documents).flatMap((document, index) => {
    if (
      !record(document) ||
      document.ownerId !== actorId ||
      document.taskId !== task.id
    )
      return [];
    return [
      {
        key: "document:" + index,
        title: text(document.title) ?? "Document title not recorded",
        versions: list(document.versions).flatMap((version, versionIndex) =>
          record(version)
            ? [
                {
                  key: "version:" + versionIndex,
                  version:
                    exactVersion(version.version) ?? "Version not recorded",
                  status: text(version.status) ?? "Unknown",
                  content:
                    typeof version.content === "string"
                      ? version.content
                      : null,
                },
              ]
            : [],
        ),
      },
    ];
  });
  return { task, documents, documentsAvailable: Array.isArray(p.documents) };
}
export type MyTaskSelection = {
  project: AdminProjectData;
  actorId: string;
  key: string;
};
export function selectedOwnTaskDetail(
  p: AdminProjectData,
  actorId: string,
  selection: MyTaskSelection | null,
  personName?: PersonName,
) {
  if (!selection || selection.project !== p || selection.actorId !== actorId)
    return null;
  return ownTaskDetail(p, actorId, selection.key, personName);
}
