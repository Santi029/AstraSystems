import {
  activityRows,
  type AdminProjectData,
  type PersonName,
} from "./admin-view-model";
import "./admin-views.css";
type Props = { p: AdminProjectData; personName: PersonName };
export function AdminActivity({ p, personName }: Props) {
  const rows = activityRows(p, personName);
  return (
    <section
      className="astra-admin-activity panel"
      aria-label="Project activity"
    >
      <header className="admin-view-heading">
        <div>
          <h2>Activity</h2>
          <p>
            Recorded changes, their authors and source revisions. Dates are
            shown in UTC.
          </p>
        </div>
      </header>
      <p className="admin-view-count">
        {rows.length} recorded {rows.length === 1 ? "event" : "events"} · Full
        available history
      </p>
      {rows.length ? (
        <div
          className="admin-table-scroll"
          role="region"
          aria-label="Project activity table"
          tabIndex={0}
        >
          <table className="admin-record-table">
            <caption className="admin-visually-hidden">
              Project change log with recorded authors and revisions
            </caption>
            <thead>
              <tr>
                <th scope="col">Date · UTC</th>
                <th scope="col">Author</th>
                <th scope="col">Action</th>
                <th scope="col">Revision</th>
                <th scope="col">Recorded details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>
                    {row.date.iso ? (
                      <time dateTime={row.date.iso}>{row.date.label}</time>
                    ) : (
                      row.date.label
                    )}
                  </td>
                  <td>{row.author}</td>
                  <th scope="row">{row.action}</th>
                  <td>
                    {row.revisions.length ? (
                      <ul className="admin-version-list">
                        {row.revisions.map((revision, index) => (
                          <li key={index}>{revision}</li>
                        ))}
                      </ul>
                    ) : (
                      "Not recorded"
                    )}
                  </td>
                  <td>
                    {row.details.length ? (
                      <dl className="admin-record-details">
                        {row.details.map((detail, index) => (
                          <div key={index}>
                            <dt>{detail.label}</dt>
                            <dd>{detail.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      "No additional details recorded"
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
            {Array.isArray(p.audit)
              ? "No activity recorded"
              : "Activity records not available"}
          </h3>
          <p>Only recorded project changes are listed here.</p>
        </div>
      )}
    </section>
  );
}
