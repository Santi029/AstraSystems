import { roleDisplayLabel } from "./role-display";
import { useRef, useState } from "react";
import { dashboardTeam } from "./admin-dashboard-model";
type Person = { id: string; name?: string; email?: string };
type Row = {
  key: string;
  personId: string;
  name: string;
  email: string;
  role: string;
};
const ROLES = [
  "Admin",
  "Stakeholder",
  "UX Designer",
  "Architecture",
  "Full Stack Development",
  "QA",
  "PM",
  "DevOps",
];
export function SpecialistTeamPreview({
  project,
  people,
}: {
  project: any;
  people: Person[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    dashboardTeam(project, people).flatMap((p) =>
      p.roles.map((role, index) => ({
        key: `${p.id}-${index}`,
        personId: p.id,
        name: p.name || "Not recorded",
        email: people.find((x) => x.id === p.id)?.email || "Not recorded",
        role,
      })),
    ),
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [mode, setMode] = useState("existing");
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("UX Designer");
  const [changed, setChanged] = useState(false);
  const available = [...people];
  for (const row of rows)
    if (!available.some((p) => p.id === row.personId))
      available.push({ id: row.personId, name: row.name, email: row.email });
  const occupied = (value: string) =>
    ["Admin", "Stakeholder", "PM"].includes(value) &&
    rows.some((r) => r.role === value && r.key !== editing);
  function open(row?: Row) {
    setEditing(row?.key || null);
    setMode("existing");
    setPersonId(row?.personId || "");
    setRole(row?.role || "UX Designer");
    setName("");
    setEmail("");
    dialog.current?.showModal();
  }
  function close() {
    dialog.current?.close();
  }
  return (
    <section className="panel padded admin-team-preview">
      <div className="inline spread">
        <h2>Team</h2>
        <button type="button" onClick={() => open()}>
          Add Member
        </button>
      </div>
      {changed && (
        <p className="muted" role="status">
          Preview only · changes are not saved and no invitations are sent.
        </p>
      )}
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Project team</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col">Email</th>
              <th scope="col">Explicit role</th>

            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.name}</td>
                <td>{row.email}</td>
                <td>{roleDisplayLabel(row.role)}</td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <dialog
        ref={dialog}
        className="person-dialog"
        aria-labelledby="team-preview-title"
      >
        <div className="modal-heading">
          <h2 id="team-preview-title">
            {editing ? "Edit assignment" : "Add Member"}
          </h2>
          <button
            type="button"
            aria-label="Close member dialog"
            onClick={close}
          >
            ×
          </button>
        </div>
        <p className="muted">
          Visual preview only. No accounts, assignments or invitations will be
          saved.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (occupied(role)) return;
            const person =
              mode === "existing"
                ? available.find((p) => p.id === personId)
                : {
                    id: `preview-${Date.now()}`,
                    name: name.trim(),
                    email: email.trim(),
                  };
            if (!person || !person.name) return;
            const row = {
              key: editing || `preview-${Date.now()}`,
              personId: person.id,
              name: person.name,
              email: person.email || "Not recorded",
              role,
            };
            setRows((old) =>
              editing
                ? old.map((r) => (r.key === editing ? row : r))
                : [...old, row],
            );
            setChanged(true);
            close();
          }}
        >
          <label>
            Member
            <select
              aria-label="Member"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="existing">Existing member</option>
              <option value="new">New member</option>
            </select>
          </label>
          {mode === "existing" ? (
            <label>
              Person
              <select
                aria-label="Person"
                required
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
              >
                <option value="">Choose a person</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.email || p.id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                Name
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Email
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            Project role
            <select
              aria-label="Project role"
              value={role}
              disabled={!!editing}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r} disabled={occupied(r)}>
                  {roleDisplayLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {editing
              ? "Reassign this project role without changing anyone’s profile."
              : "One Admin, one Stakeholder and one Technical Product Owner per project. Other specialist roles may repeat."}
          </p>
          <div className="modal-actions">
            <button type="button" onClick={close}>
              Cancel
            </button>
            <button className="primary" disabled={occupied(role)}>
              {editing ? "Preview reassignment" : "Preview member"}
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
