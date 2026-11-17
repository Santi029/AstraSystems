import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { AdminProjectData, PersonName } from "./admin-view-model";
import {
  MY_TASK_PAGE_SIZES,
  ownTaskRows,
  myTaskStatusOptions,
  filterMyTasks,
  paginateMyTasks,
  shouldRecommendSrs,
  selectedOwnTaskDetail,
  type MyTaskSelection,
  type MyTaskRow,
  type ownTaskDetail,
} from "./admin-my-tasks-model";
import "./admin-my-tasks.css";

type Props = {
  p: AdminProjectData;
  actorId: string;
  personName: PersonName;
  summary?: boolean;
  onAddSelectedTasks?: (titles: readonly string[]) => void;
  taskCreationState?: {
    scope: string;
    busy: boolean;
    blocked: boolean;
    message: string;
  };
};
type TaskDetail = NonNullable<ReturnType<typeof ownTaskDetail>>;
const RECOMMENDED_VISUAL_TASKS = [
  "Software Requirements Specification (SRS)",
] as const;

function TaskDetailDialog({
  detail,
  onClose,
}: {
  detail: TaskDetail;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId(),
    noteId = useId();
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);
  return (
    <dialog
      className="astra-my-task-dialog"
      ref={dialog}
      aria-labelledby={headingId}
      aria-describedby={noteId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="my-task-dialog-heading">
        <div>
          <h2 id={headingId}>{detail.task.title}</h2>
          <p id={noteId}>Read only</p>
        </div>
        <button type="button" autoFocus onClick={onClose}>
          Close
        </button>
      </header>
      <div className="my-task-dialog-body">
        <dl>
          <div>
            <dt>Responsible</dt>
            <dd>{detail.task.responsible}</dd>
          </div>
          <div>
            <dt>Work status</dt>
            <dd>{detail.task.status.label}</dd>
          </div>
        </dl>
        <h3>Description</h3>
        <p className="my-task-description">
          {detail.task.description ?? "Description not recorded."}
        </p>
        <h3>Task documents</h3>
        {!detail.documentsAvailable ? (
          <p>Document records not available.</p>
        ) : !detail.documents.length ? (
          <p>No documents owned by you are recorded for this task.</p>
        ) : (
          detail.documents.map((document) => (
            <article className="my-task-document" key={document.key}>
              <h4>{document.title}</h4>
              {document.versions.length ? (
                document.versions.map((version) => (
                  <details key={version.key}>
                    <summary>
                      {version.version} · {version.status}
                    </summary>
                    {version.content === null ? (
                      <p>Content not recorded.</p>
                    ) : version.content === "" ? (
                      <p>This version is empty.</p>
                    ) : (
                      <pre
                        tabIndex={0}
                        aria-label={
                          document.title + " " + version.version + " content"
                        }
                      >
                        {version.content}
                      </pre>
                    )}
                  </details>
                ))
              ) : (
                <p>No document versions recorded.</p>
              )}
            </article>
          ))
        )}
      </div>
    </dialog>
  );
}
function TaskDate({
  value,
  example,
}: {
  value?: string | null;
  example?: boolean;
}) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    return <>Not recorded</>;
  return (
    <>
      <time dateTime={value}>
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(value))}
      </time>
      {example && <span className="my-tasks-example-date">Example</span>}
    </>
  );
}
function MyTasksTable({
  rows,
  onOpen,
}: {
  rows: readonly MyTaskRow[];
  onOpen: (row: MyTaskRow) => void;
}) {
  return (
    <div
      className="my-tasks-table-scroll"
      role="region"
      aria-label="My tasks table"
      tabIndex={0}
    >
      <table className="my-tasks-table">
        <caption className="my-tasks-visually-hidden">
          Your assigned tasks
        </caption>
        <colgroup>
          <col />
          <col className="my-tasks-date-column" />
          <col className="my-tasks-date-column" />
          <col className="my-tasks-status-column" />
          <col className="my-tasks-action-column" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Task</th>
            <th scope="col">Created</th>
            <th scope="col">Last Updated</th>
            <th scope="col">Work status</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                {row.title}
                {!row.canOpen && (
                  <span className="my-tasks-missing">
                    Task identifier is missing or ambiguous.
                  </span>
                )}
              </th>
              <td className="my-tasks-date">
                <TaskDate value={row.createdAt} example={row.exampleDates} />
              </td>
              <td className="my-tasks-date">
                <TaskDate value={row.updatedAt} example={row.exampleDates} />
              </td>
              <td>
                <span
                  className={
                    "my-tasks-status my-tasks-status-" + row.status.tone
                  }
                >
                  {row.status.label}
                </span>
              </td>
              <td>
                <button
                  type="button"
                  className="my-tasks-open"
                  disabled={!row.canOpen}
                  onClick={() => {
                    if (row.canOpen) onOpen(row);
                  }}
                  aria-label={"Open " + row.title}
                >
                  Open <ArrowRight size={16} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AdminMyTasks({
  p,
  actorId,
  personName,
  summary = false,
  onAddSelectedTasks,
  taskCreationState,
}: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selection, setSelection] = useState<MyTaskSelection | null>(null);
  const [recommendedSelection, setRecommendedSelection] = useState<{
    project: AdminProjectData;
    creationScope?: string;
    actorId: string;
    titles: readonly string[];
    customTitles: readonly string[];
    customName: string;
    error: string;
  } | null>(null);
  const visualRecommendations =
    (taskCreationState
      ? recommendedSelection?.creationScope === taskCreationState.scope
      : recommendedSelection?.project === p) &&
    recommendedSelection?.actorId === actorId
      ? recommendedSelection
      : {
          titles: [] as readonly string[],
          customTitles: [] as readonly string[],
          customName: "",
          error: "",
        };
  const recommendationTitles = [
    ...RECOMMENDED_VISUAL_TASKS,
    ...visualRecommendations.customTitles,
  ];
  const updateRecommendations = (
    changes: Partial<typeof visualRecommendations>,
  ) =>
    setRecommendedSelection({
      ...visualRecommendations,
      ...changes,
      project: p,
      creationScope: taskCreationState?.scope,
      actorId,
    });
  const creationLocked =
    taskCreationState?.busy || taskCreationState?.blocked || false;
  const searchId = useId(),
    statusId = useId(),
    rowsId = useId(),
    unavailableId = useId(),
    recommendationId = useId(),
    recommendationNoteId = useId(),
    customTaskId = useId();
  const actorAvailable =
    typeof actorId === "string" && actorId.trim().length > 0;
  const tasksAvailable = actorAvailable && Array.isArray(p.tasks);
  const rows = ownTaskRows(p, actorId, personName);
  const options = myTaskStatusOptions(rows);
  const activeStatus = options.some((option) => option.key === status)
    ? status
    : "all";
  const filtered = filterMyTasks(rows, query, activeStatus);
  const shown = paginateMyTasks(filtered, page, pageSize);
  const detail = selectedOwnTaskDetail(p, actorId, selection, personName);
  if (summary) {
    if (!rows.length) return null;
    return (
      <section className="astra-admin-my-tasks panel" aria-label="My Tasks">
        <header className="my-tasks-heading">
          <h2>My Tasks</h2>
        </header>
        <MyTasksTable
          rows={rows}
          onOpen={(row) => setSelection({ project: p, actorId, key: row.key })}
        />
        {detail && (
          <TaskDetailDialog
            detail={detail}
            onClose={() => setSelection(null)}
          />
        )}
      </section>
    );
  }
  return (
    <section className="astra-admin-my-tasks panel" aria-label="My Tasks">
      <header className="my-tasks-heading">
        <h2>My Tasks</h2>
        <form
          className="my-tasks-custom-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (creationLocked) return;
            const title = visualRecommendations.customName.trim();
            if (!title) return;
            if (
              recommendationTitles.some(
                (item) => item.toLowerCase() === title.toLowerCase(),
              )
            ) {
              updateRecommendations({
                error: "This name is already in the list.",
              });
              return;
            }
            if (visualRecommendations.customTitles.length >= 20) {
              updateRecommendations({
                error: "You can add up to 20 custom names to this selection.",
              });
              return;
            }
            updateRecommendations({
              customTitles: [...visualRecommendations.customTitles, title],
              customName: "",
              error: "",
            });
          }}
        >
          <label className="my-tasks-visually-hidden" htmlFor={customTaskId}>
            Custom task name
          </label>
          <input
            id={customTaskId}
            type="text"
            placeholder="Enter a custom task name"
            maxLength={120}
            disabled={creationLocked}
            value={visualRecommendations.customName}
            aria-describedby={recommendationNoteId}
            onChange={(event) =>
              updateRecommendations({
                customName: event.target.value,
                error: "",
              })
            }
          />
          <button
            type="submit"
            disabled={
              creationLocked || !visualRecommendations.customName.trim()
            }
          >
            <Plus size={16} aria-hidden="true" /> Add
          </button>
        </form>
      </header>
      <div className="my-tasks-filters">
        <label htmlFor={searchId}>
          <span className="my-tasks-visually-hidden">Search my tasks</span>
          <input
            id={searchId}
            type="search"
            placeholder="Search my tasks…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label htmlFor={statusId}>
          <span className="my-tasks-visually-hidden">Status</span>
          <select
            id={statusId}
            value={activeStatus}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                Status: {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.rows.length ? (
        <MyTasksTable
          rows={shown.rows}
          onOpen={(row) => setSelection({ project: p, actorId, key: row.key })}
        />
      ) : (
        <p className="my-tasks-empty">
          {!actorAvailable
            ? "Current user not available."
            : !Array.isArray(p.tasks)
              ? "Task records not available."
              : !rows.length
                ? "No tasks assigned to you."
                : "No matching tasks."}
        </p>
      )}
      {tasksAvailable && (
        <footer className="my-tasks-pagination">
          <p role="status">
            Showing {shown.from}–{shown.to} of {shown.total} tasks
          </p>
          <label htmlFor={rowsId}>
            <span className="my-tasks-visually-hidden">Rows per page</span>
            <select
              id={rowsId}
              value={shown.pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {MY_TASK_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  Rows: {size}
                </option>
              ))}
            </select>
          </label>
          <nav aria-label="Task pages">
            <button
              type="button"
              disabled={!shown.hasPrevious}
              onClick={() => setPage(shown.page - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Previous
            </button>
            <span>
              Page {shown.page} of {shown.pageCount}
            </span>
            <button
              type="button"
              disabled={!shown.hasNext}
              onClick={() => setPage(shown.page + 1)}
            >
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
          </nav>
        </footer>
      )}
      {(onAddSelectedTasks || shouldRecommendSrs(p, actorId)) && (
        <aside
          className="my-tasks-recommendation"
          aria-label="Task suggestions"
        >
          <h3 className="my-tasks-ai-heading">
            Task suggestions
          </h3>
          <p>SRS is a predefined suggestion, not generated by AI. Custom names are entered by you. Selecting a name does not save a task.</p>
          <div className="my-tasks-recommendation-box">
            {visualRecommendations.error && (
              <p className="my-tasks-custom-error" role="alert">
                {visualRecommendations.error}
              </p>
            )}
            <ul className="my-tasks-recommendation-list">
              {recommendationTitles.map((title, index) => (
                <li key={title}>
                  <label htmlFor={recommendationId + index}>
                    <input
                      id={recommendationId + index}
                      type="checkbox"
                      disabled={creationLocked}
                      checked={visualRecommendations.titles.includes(title)}
                      aria-describedby={recommendationNoteId}
                      onChange={(event) =>
                        updateRecommendations({
                          titles: event.target.checked
                            ? [...visualRecommendations.titles, title]
                            : visualRecommendations.titles.filter(
                                (item) => item !== title,
                              ),
                        })
                      }
                    />
                    <span className="my-tasks-recommendation-title">
                      {title}
                      {visualRecommendations.titles.includes(title) && (
                        <ArrowRight
                          size={14}
                          aria-hidden="true"
                          className="my-tasks-selected-arrow"
                        />
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={
                creationLocked ||
                !onAddSelectedTasks ||
                !visualRecommendations.titles.length
              }
              onClick={() => onAddSelectedTasks?.(visualRecommendations.titles)}
            >
              Add Selected Tasks
            </button>
            <span id={recommendationNoteId}>
              {taskCreationState?.message ??
                (onAddSelectedTasks
                  ? "Demo only · Tasks stay in this demo session, not saved."
                  : "Not created or saved")}
            </span>
          </div>
        </aside>
      )}
      {detail && (
        <TaskDetailDialog detail={detail} onClose={() => setSelection(null)} />
      )}
    </section>
  );
}
