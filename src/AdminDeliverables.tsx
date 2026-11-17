import { useState } from "react";
import {
  DELIVERABLE_FILTERS,
  deliveryRows,
  selectDeliveryRows,
  type AdminProjectData,
  type AdminSourceRecord,
  type DeliveryFilter,
  type PersonName,
} from "./admin-view-model";
import "./admin-views.css";

type Props = {
  p: AdminProjectData;
  personName: PersonName;
  onOpenDelivery: (delivery: AdminSourceRecord) => void | Promise<unknown>;
  busy?: boolean;
  recentLimit?: number;
  pendingOnly?: boolean;
  onViewAll?: () => void;
};
export function AdminDeliverables({
  p,
  personName,
  onOpenDelivery,
  busy = false,
  recentLimit,
  pendingOnly = false,
  onViewAll,
}: Props) {
  const [filter, setFilter] = useState<DeliveryFilter>("all");
  const all = deliveryRows(p, personName, pendingOnly);
  const recent =
    Number.isSafeInteger(recentLimit) && (recentLimit as number) > 0;
  const rows = selectDeliveryRows(
    all,
    recent || pendingOnly ? "all" : filter,
    recent ? recentLimit : undefined,
  );
  return (
    <section
      className="astra-admin-deliverables panel"
      aria-label={
        recent || pendingOnly ? "Project deliverables" : "Deliverables"
      }
    >
      <header className="admin-view-heading">
        <div>
          <h2>
            {recent || pendingOnly ? "Project Deliverables" : "Deliverables"}
          </h2>
          <p>
            {pendingOnly
              ? "Pending and in-review specialist submissions."
              : recent
                ? "Latest recorded specialist submissions."
                : "Every specialist submission, with its recorded status and exact document versions."}
          </p>
        </div>
        {(recent || pendingOnly) && onViewAll && (
          <button type="button" onClick={onViewAll}>
            View all deliverables
          </button>
        )}
      </header>
      {!recent && !pendingOnly && (
        <div
          className="admin-status-filters"
          role="group"
          aria-label="Filter deliverables by status"
        >
          {DELIVERABLE_FILTERS.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}{" "}
              <span>
                {item.id === "all"
                  ? all.length
                  : all.filter((row) => row.status.key === item.id).length}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="admin-view-count" role="status">
        {rows.length} of {all.length} {pendingOnly ? "pending" : "recorded"}{" "}
        deliverables shown
        {recent || pendingOnly
          ? " · Recent view only; full history is preserved."
          : "."}
      </p>
      {rows.length ? (
        <div
          className="admin-table-scroll"
          role="region"
          aria-label="Deliverables table"
          tabIndex={0}
        >
          <table className="admin-record-table">
            <caption className="admin-visually-hidden">
              Specialist deliverables and exact submitted versions
            </caption>
            <thead>
              <tr>
                <th scope="col">Deliverable</th>
                <th scope="col">Submitted by</th>
                <th scope="col">Submitted · UTC</th>
                <th scope="col">Status</th>
                <th scope="col">Submitted documents</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">
                    <strong>{row.title}</strong>
                    <span className="admin-cell-note">{row.version}</span>
                    {row.feedback && (
                      <p className="admin-record-feedback">
                        <strong>Review feedback:</strong> {row.feedback}
                      </p>
                    )}
                  </th>
                  <td>{row.author}</td>
                  <td>
                    {row.date.iso ? (
                      <time dateTime={row.date.iso}>{row.date.label}</time>
                    ) : (
                      row.date.label
                    )}
                  </td>
                  <td>
                    <span
                      className={
                        "admin-delivery-status admin-status-" + row.status.key
                      }
                    >
                      {row.status.label}
                    </span>
                  </td>
                  <td>
                    {row.documents.length ? (
                      <ul className="admin-version-list">
                        {row.documents.map((document, index) => (
                          <li key={index}>
                            {document.title} <strong>{document.version}</strong>
                          </li>
                        ))}
                      </ul>
                    ) : row.snapshotsRecorded ? (
                      "No document versions recorded"
                    ) : (
                      "Document versions not recorded"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      disabled={busy || !row.id}
                      onClick={() => onOpenDelivery(row.source)}
                      aria-label={"Open " + row.title + " " + row.version}
                    >
                      Open delivery
                    </button>
                    {!row.id && (
                      <span className="admin-cell-note">
                        Delivery identifier not recorded
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="admin-view-empty">
          <h3>
            {!Array.isArray(p.deliveries)
              ? "Delivery records not available"
              : pendingOnly
                ? "No pending deliverables"
                : all.length
                  ? "No deliverables in this status"
                  : "No deliverables yet"}
          </h3>
          <p>
            {pendingOnly
              ? "Approved and changes-requested submissions remain in the full Deliverables view."
              : all.length
                ? "Choose All to inspect the recorded submissions."
                : "Specialist submissions will appear here after they are sent for review."}
          </p>
        </div>
      )}
      {all.some((row) => row.timestamp === null) && (
        <p className="admin-view-count">
          Missing submission dates are shown as “Not recorded” and kept after
          dated submissions in their original order.
        </p>
      )}
    </section>
  );
}
