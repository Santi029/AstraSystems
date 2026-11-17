import { useEffect, useId, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import type { AdminProjectData, PersonName } from "./admin-view-model";
import {
  approvedReferenceRows,
  filterApprovedReferences,
  visibleApprovedReferences,
  sortApprovedReferences,
  type ReferenceSort,
  selectedReferenceRow,
  type ApprovedReferenceRow,
  type ReferenceSelection,
} from "./admin-reference-model";
import "./admin-reference-documents.css";

type Props = { p: AdminProjectData; personName?: PersonName };

function ReferenceVersionDialog({
  row,
  onClose,
}: {
  row: ApprovedReferenceRow;
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
      className="astra-reference-dialog"
      ref={dialog}
      aria-labelledby={headingId}
      aria-describedby={noteId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header className="reference-dialog-heading">
        <div>
          <h2 id={headingId}>
            {row.title} · {row.version}
          </h2>
          <p id={noteId}>Approved version · Read only</p>
        </div>
        <button type="button" onClick={onClose} autoFocus>
          Close
        </button>
      </header>
      {row.content === null ? (
        <p className="reference-content-empty">
          Content not recorded for this approved version.
        </p>
      ) : row.content === "" ? (
        <p className="reference-content-empty">
          This approved version is empty.
        </p>
      ) : (
        <pre
          className="reference-exact-content"
          tabIndex={0}
          aria-label="Approved version content"
        >
          {row.content}
        </pre>
      )}
    </dialog>
  );
}

function ReferenceTimestamp({
  value,
}: {
  value: ApprovedReferenceRow["approvedAt"];
}) {
  if (!value.iso) return <>{value.label}</>;
  const date = new Date(value.iso);
  return (
    <time dateTime={value.iso} title={value.label}>
      <span>
        {new Intl.DateTimeFormat("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          timeZone: "UTC",
        }).format(date)}
      </span>
      <span>
        {new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
          ...(date.getUTCSeconds() ? { second: "2-digit" as const } : {}),
          timeZone: "UTC",
        }).format(date)}
      </span>
    </time>
  );
}

function ReferenceDocumentsList({
  rows,
  onOpen,
  sort = null,
  onSort,
}: {
  rows: readonly ApprovedReferenceRow[];
  onOpen: (row: ApprovedReferenceRow) => void;
  sort?: ReferenceSort | null;
  onSort?: (column: ReferenceSort["column"]) => void;
}) {
  const columns = [
    ["title", "Deliverable"],
    ["responsible", "Responsible"],
    ["approvedAt", "Approved at"],
    ["updatedAt", "Updated at"],
  ] as const;
  return (
    <div
      className="reference-table-scroll"
      role="region"
      aria-label="Approved reference versions"
      tabIndex={0}
    >
      <table className="reference-document-table">
        <caption className="reference-visually-hidden">
          Approved document versions · Read only · Times in UTC
        </caption>
        <colgroup>
          <col className="reference-deliverable-column" />
          <col className="reference-responsible-column" />
          <col />
          <col />
        </colgroup>
        <thead>
          <tr>
            {columns.map(([column, label]) => {
              const active = sort?.column === column;
              const Icon = active
                ? sort.direction === "ascending"
                  ? ArrowUp
                  : ArrowDown
                : ArrowUpDown;
              return (
                <th
                  key={column}
                  scope="col"
                  aria-sort={active ? sort.direction : "none"}
                >
                  {onSort ? (
                    <button
                      type="button"
                      className="reference-sort"
                      aria-label={"Sort by " + label}
                      onClick={() => onSort(column)}
                    >
                      {label}
                      <Icon size={12} aria-hidden="true" />
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">
                <button
                  type="button"
                  className="reference-document-link"
                  disabled={!row.canOpen}
                  onClick={() => {
                    if (row.canOpen) onOpen(row);
                  }}
                  aria-label={"Open approved " + row.title + " " + row.version}
                >
                  {row.title}
                </button>
                <span className="reference-version">
                  {row.version} · Approved
                </span>
                {!row.canOpen && (
                  <span className="reference-missing">
                    Document identifier or version not recorded
                  </span>
                )}
              </th>
              <td>{row.responsible}</td>
              <td>
                <ReferenceTimestamp value={row.approvedAt} />
              </td>
              <td>
                <ReferenceTimestamp value={row.updatedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminReferenceDocuments({ p, personName }: Props) {
  const rows = approvedReferenceRows(p, personName);
  const [selection, setSelection] = useState<ReferenceSelection | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState<ReferenceSort | null>(null);
  const selected = selectedReferenceRow(p, rows, selection);
  const filtered = filterApprovedReferences(rows, search);
  const shown = visibleApprovedReferences(
    sortApprovedReferences(filtered, sort),
    expanded,
  );
  const searchId = useId(),
    specialtyId = useId();
  return (
    <section
      className="astra-admin-references panel"
      aria-label="Reference Documents"
    >
      <header className="reference-panel-heading">
        <h2>Reference Documents</h2>
        <p>Read only · Approved documents · Times in UTC</p>
      </header>
      <div className="reference-filters">
        <label htmlFor={searchId}>
          <span className="reference-visually-hidden">
            Search document/responsible
          </span>
          <input
            id={searchId}
            type="search"
            placeholder="Search document / responsible"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label htmlFor={specialtyId}>
          <span className="reference-visually-hidden">Specialty</span>
          <select
            id={specialtyId}
            disabled
            value="all"
            title="Specialty not recorded. Filtering by specialty is unavailable."
          >
            <option value="all">Specialty: All</option>
          </select>
        </label>
      </div>
      {shown.length ? (
        <ReferenceDocumentsList
          rows={shown}
          sort={sort}
          onSort={(column) =>
            setSort((current) => ({
              column,
              direction:
                current?.column === column && current.direction === "ascending"
                  ? "descending"
                  : "ascending",
            }))
          }
          onOpen={(row) => setSelection({ project: p, key: row.key })}
        />
      ) : (
        <p className="reference-panel-empty">
          {!Array.isArray(p.documents)
            ? "Document records not available."
            : rows.length
              ? "No approved document versions match this search."
              : "No approved document versions available."}
        </p>
      )}
      <footer className="reference-view-all">
        <p className="reference-count" role="status">
          {shown.length} of {filtered.length} approved{" "}
          {filtered.length === 1 ? "version" : "versions"} shown
          {search.trim() && <> · {rows.length} total in this project</>}
        </p>
        <button
          type="button"
          aria-expanded={expanded}
          disabled={!expanded && filtered.length <= 5}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer" : "View All"}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </footer>
      {selected && (
        <ReferenceVersionDialog
          row={selected}
          onClose={() => setSelection(null)}
        />
      )}
    </section>
  );
}
