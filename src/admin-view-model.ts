/** Read-only projections of the existing delivery/audit DTO. No inferred events or revisions. */
export type AdminSourceRecord = Record<string, unknown>;
export type AdminProjectData = {
  [key: string]: unknown;
  deliveries?: unknown;
  documents?: unknown;
  tasks?: unknown;
  audit?: unknown;
};
export type PersonName = (id: string) => string | undefined;
export type DeliveryFilter =
  | "all"
  | "submitted"
  | "under_review"
  | "approved"
  | "returned";
export const DELIVERABLE_FILTERS: ReadonlyArray<{
  id: DeliveryFilter;
  label: string;
}> = Object.freeze([
  { id: "all", label: "All" },
  { id: "submitted", label: "Pending review" },
  { id: "under_review", label: "Under review" },
  { id: "approved", label: "Approved" },
  { id: "returned", label: "Changes requested" },
]);
const record = (value: unknown): value is AdminSourceRecord =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
export const exactVersion = (value: unknown): string | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1
    ? "v" + value
    : null;
export function readableLabel(value: string): string {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
export function deliveryStatus(value: unknown): {
  key: Exclude<DeliveryFilter, "all"> | "other";
  label: string;
} {
  const raw = string(value);
  const key = raw?.trim().toLowerCase().replace(/\s+/g, "_");
  if (key === "changes_requested")
    return { key: "returned", label: "Changes requested" };
  const known = DELIVERABLE_FILTERS.find(
    (item) => item.id !== "all" && item.id === key,
  );
  return known
    ? { key: known.id as Exclude<DeliveryFilter, "all">, label: known.label }
    : {
        key: "other",
        label: raw
          ? "Recorded status: " + readableLabel(raw)
          : "Status not recorded",
      };
}
/** Require an actual ISO instant with timezone; never use today, local timezone or another event date. */
export function recordedInstant(value: unknown): {
  epoch: number | null;
  label: string;
  iso: string | null;
} {
  const absent = { epoch: null, label: "Not recorded", iso: null };
  if (typeof value !== "string") return absent;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(
      value,
    );
  if (!match || match[0] !== value) return absent;
  const [, year, month, day, hour, minute, second] = match.map(String);
  const calendar = new Date(year + "-" + month + "-" + day + "T00:00:00Z");
  if (
    !Number.isFinite(calendar.getTime()) ||
    calendar.toISOString().slice(0, 10) !== year + "-" + month + "-" + day ||
    Number(hour) > 23 ||
    Number(minute) > 59 ||
    Number(second) > 59
  )
    return absent;
  const parsed = new Date(value),
    epoch = parsed.getTime();
  if (!Number.isFinite(epoch)) return absent;
  return {
    epoch,
    iso: parsed.toISOString(),
    label:
      new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(parsed) + " UTC",
  };
}
function author(value: unknown, personName: PersonName): string {
  const id = string(value);
  if (!id) return "Not recorded";
  return string(personName(id)) ?? id;
}
function sortRecorded<T extends { timestamp: number | null; index: number }>(
  rows: T[],
): T[] {
  return rows.sort((a, b) => {
    if (a.timestamp === null && b.timestamp !== null) return 1;
    if (b.timestamp === null && a.timestamp !== null) return -1;
    return a.timestamp !== null &&
      b.timestamp !== null &&
      a.timestamp !== b.timestamp
      ? b.timestamp - a.timestamp
      : a.index - b.index;
  });
}
export type DeliveryRow = {
  key: string;
  source: AdminSourceRecord;
  id: string | null;
  index: number;
  title: string;
  version: string;
  status: ReturnType<typeof deliveryStatus>;
  author: string;
  date: ReturnType<typeof recordedInstant>;
  timestamp: number | null;
  documents: { title: string; version: string }[];
  snapshotsRecorded: boolean;
  feedback: string | null;
};
export function deliveryRows(
  project: AdminProjectData,
  personName: PersonName,
  pendingOnly = false,
): DeliveryRow[] {
  return sortRecorded(
    list(project.deliveries)
      .map((value, index) => ({ value, index }))
      .filter(
        ({ value }) =>
          !pendingOnly ||
          (record(value) &&
            (value.status === "submitted" || value.status === "under_review")),
      )
      .map(({ value, index }) => {
        const d = record(value) ? value : {};
        const date = recordedInstant(d.submittedAt);
        const id = string(d.id);
        return {
          key: (id ?? "missing") + ":" + index,
          source: d,
          id,
          index,
          title: string(d.title) ?? "Specialist delivery",
          version: exactVersion(d.version) ?? "Version not recorded",
          status: deliveryStatus(d.status),
          author: author(d.submittedBy, personName),
          date,
          timestamp: date.epoch,
          documents: list(d.documentVersions).map((item) => {
            const snapshot = record(item) ? item : {};
            return {
              title:
                string(snapshot.title) ??
                (string(snapshot.documentId)
                  ? "Document " + snapshot.documentId
                  : "Document title not recorded"),
              version: exactVersion(snapshot.version) ?? "Version not recorded",
            };
          }),
          snapshotsRecorded: Array.isArray(d.documentVersions),
          feedback: string(d.feedback),
        };
      }),
  );
}
export function selectDeliveryRows(
  rows: readonly DeliveryRow[],
  filter: DeliveryFilter = "all",
  recentLimit?: number,
): DeliveryRow[] {
  const selected = rows.filter(
    (row) => filter === "all" || row.status.key === filter,
  );
  return Number.isSafeInteger(recentLimit) && (recentLimit as number) > 0
    ? selected.slice(0, recentLimit)
    : selected;
}
const ACTION_LABELS: Record<string, string> = {
  createProject: "Project created",
  assignRole: "Project role assigned",
  createTask: "Task and working documents created",
  setRequiredSources: "Required PRD sources selected",
  assignQuestionnaire: "Questionnaire assigned",
  readNotice: "Delivery notice opened",
  openReview: "Delivery review started",
  approveDelivery: "Delivery approved",
  returnDelivery: "Changes requested",
  saveDraft: "Document draft saved",
  beginRevision: "New document revision started",
  submitDocuments: "Documents submitted for review",
  completeTask: "Task completion declared",
  selectTasks: "Work selected",
  activateTask: "Task activated",
  preparePrd: "PRD draft prepared",
  closePrd: "PRD closed",
  saveQuestionnaire: "Questionnaire draft saved",
  submitQuestionnaire: "Questionnaire responses submitted",
  simulateAi: "Simulated assistant response recorded",
  previewExternal: "Simulated external update prepared",
  publishExternal: "Simulated external update attempted",
  checkExternal: "Simulated external result checked",
  retryExternal: "Simulated external update retried",
  fixture_created: "Synthetic fixture created",
};
function namedItem(
  project: AdminProjectData,
  kind: "documents" | "tasks",
  id: unknown,
): string {
  const identifier = string(id);
  if (!identifier) return "Not recorded";
  const item = list(project[kind]).find(
    (value) => record(value) && value.id === identifier,
  );
  return record(item) ? (string(item.title) ?? identifier) : identifier;
}
export type DetailLine = { label: string; value: string };
function snapshotText(value: unknown, project: AdminProjectData): string {
  if (!record(value)) return "Version reference not recorded";
  return (
    (string(value.title) ?? namedItem(project, "documents", value.documentId)) +
    " · " +
    (exactVersion(value.version) ?? "Version not recorded")
  );
}
function detailLines(
  details: unknown,
  project: AdminProjectData,
  personName: PersonName,
  prefix = "",
  depth = 0,
): DetailLine[] {
  if (!record(details))
    return string(details) ? [{ label: "Note", value: String(details) }] : [];
  if (depth > 6)
    return [
      {
        label: prefix || "Detail",
        value: "Nested details are not available in this view",
      },
    ];
  return Object.entries(details).flatMap(([key, value]): DetailLine[] => {
    // Versions have a dedicated column. Snapshot contents remain in the exact delivery view.
    if (!prefix && ["version", "prdVersion"].includes(key)) return [];
    const label = (prefix ? prefix + " · " : "") + readableLabel(key);
    if (
      ["documentVersions", "sourceVersions"].includes(key) &&
      Array.isArray(value)
    )
      return [
        {
          label:
            key === "documentVersions"
              ? "Submitted document versions"
              : "Source versions",
          value: value.length
            ? value.map((item) => snapshotText(item, project)).join("; ")
            : "None recorded",
        },
      ];
    if (key === "contentHash")
      return [
        {
          label: "Source verification",
          value: string(value) ? "Hash recorded" : "Not recorded",
        },
      ];
    if (
      ["documentIds", "requiredSourceIds", "excludedDocumentIds"].includes(
        key,
      ) &&
      Array.isArray(value)
    )
      return [
        {
          label:
            key === "requiredSourceIds"
              ? "Required sources"
              : key === "excludedDocumentIds"
                ? "Excluded documents"
                : "Documents",
          value: value.length
            ? value.map((id) => namedItem(project, "documents", id)).join("; ")
            : "None recorded",
        },
      ];
    if (key === "taskIds" && Array.isArray(value))
      return [
        {
          label: "Tasks",
          value: value.length
            ? value.map((id) => namedItem(project, "tasks", id)).join("; ")
            : "None recorded",
        },
      ];
    if (["ownerId", "personId", "administrator", "assignedTo"].includes(key))
      return [
        {
          label: {
            ownerId: "Owner",
            personId: "Person",
            administrator: "Project administrator",
            assignedTo: "Assigned to",
          }[key]!,
          value: author(value, personName),
        },
      ];
    if (key === "documentId")
      return [
        { label: "Document", value: namedItem(project, "documents", value) },
      ];
    if (key === "taskId")
      return [{ label: "Task", value: namedItem(project, "tasks", value) }];
    if (key === "status")
      return [
        {
          label,
          value: string(value)
            ? ["submitted", "under_review", "approved", "returned"].includes(
                String(value),
              )
              ? deliveryStatus(value).label
              : readableLabel(String(value))
            : "Not recorded",
        },
      ];
    if (record(value))
      return detailLines(value, project, personName, label, depth + 1);
    if (Array.isArray(value)) {
      if (!value.length) return [{ label, value: "None recorded" }];
      return value.flatMap((item, index) =>
        record(item)
          ? detailLines(
              item,
              project,
              personName,
              label + " " + (index + 1),
              depth + 1,
            )
          : [
              {
                label: label + " " + (index + 1),
                value:
                  item === null || item === undefined
                    ? "Not recorded"
                    : String(item),
              },
            ],
      );
    }
    return [
      {
        label,
        value:
          value === null || value === undefined
            ? "Not recorded"
            : typeof value === "boolean"
              ? value
                ? "Yes"
                : "No"
              : String(value),
      },
    ];
  });
}
export type ActivityRow = {
  key: string;
  index: number;
  timestamp: number | null;
  date: ReturnType<typeof recordedInstant>;
  author: string;
  action: string;
  revisions: string[];
  details: DetailLine[];
};
export function activityRows(
  project: AdminProjectData,
  personName: PersonName,
): ActivityRow[] {
  return sortRecorded(
    list(project.audit).map((value, index) => {
      const event = record(value) ? value : {};
      const details = record(event.details) ? event.details : {};
      const date = recordedInstant(event.at);
      const action = string(event.action);
      const version = exactVersion(details.version ?? details.prdVersion);
      const revisions: string[] = [];
      if (version) {
        const subject = string(details.documentId)
          ? "Document"
          : string(details.deliveryId)
            ? "Delivery"
            : ["preparePrd", "closePrd"].includes(action ?? "")
              ? "PRD"
              : "Recorded version";
        revisions.push(subject + " " + version);
      }
      for (const key of ["documentVersions", "sourceVersions"]) {
        if (Array.isArray(details[key]))
          revisions.push(
            ...(details[key] as unknown[]).map((item) =>
              snapshotText(item, project),
            ),
          );
      }
      return {
        key: (string(event.id) ?? "missing") + ":" + index,
        index,
        timestamp: date.epoch,
        date,
        author: author(event.actorId, personName),
        action: action
          ? Object.hasOwn(ACTION_LABELS, action)
            ? ACTION_LABELS[action]
            : readableLabel(action)
          : "Action not recorded",
        revisions,
        details: detailLines(event.details, project, personName),
      };
    }),
  );
}
