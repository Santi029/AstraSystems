import { roleDisplayLabel } from "./role-display";
import * as React from "react";
import "./admin-project-settings.css";
type Person = { id: string; name?: string };
type Props = { project: Record<string, any>; people: Record<string, any>[] };
export function AdminProjectSettings({ project, people }: Props) {
  const initial = () => ({
    name: project.name ?? "",
    description: project.description ?? "",
    startDate: project.startDate?.slice(0, 10) ?? "",
    endDate: project.endDate?.slice(0, 10) ?? "",
    adminId: project.adminIds?.[0] ?? project.adminId ?? "",
    team: (project.team ?? []).map((entry: any) => ({
      personId: entry.personId,
      roles: [...(entry.roles ?? [])],
    })),
  });
  const [draft, setDraft] = React.useState(initial);
  const [changed, setChanged] = React.useState(false);
  const patch = (fields: Partial<typeof draft>) => {
    setDraft((current) => ({ ...current, ...fields }));
    setChanged(true);
  };
  const directory: Person[] = people
    .filter((person) => typeof person.id === "string")
    .map((person) => ({ id: person.id, name: person.name }));
  for (const id of [
    draft.adminId,
    ...draft.team.map((entry: any) => entry.personId),
  ])
    if (id && !directory.some((person) => person.id === id))
      directory.push({ id, name: id });
  const roles = [
    ...new Set([
      "Stakeholder",
      "PM",
      "Architecture",
      "QA",
      "UX Designer",
      "Full Stack Web Developer",
      "DevOps",
      ...draft.team.flatMap((entry: any) => entry.roles),
    ]),
  ].filter((role) => role !== "Admin") as string[];
  const assign = (role: string, id: string, checked: boolean) => {
    const next = draft.team
      .map((entry: any) => ({
        ...entry,
        roles: entry.roles.filter(
          (value: string) =>
            !(
              value === role &&
              (entry.personId === id ||
                role === "PM" ||
                (role === "Stakeholder" && checked))
            ),
        ),
      }))
      .filter((entry: any) => entry.roles.length);
    if (checked) {
      const member = next.find((entry: any) => entry.personId === id);
      if (member) member.roles.push(role);
      else next.push({ personId: id, roles: [role] });
    }
    patch({ team: next });
  };
  return (
    <section
      className="panel padded astra-project-settings"
      aria-label="Project Settings"
    >
      <h2>Project Settings</h2>
      <p className="muted" role="status">
        {changed
          ? "Unsaved preview changes. Nothing has been saved."
          : "Visual preview only. Saving project changes is not connected."}
      </p>
      <form onSubmit={(event) => event.preventDefault()}>
        <label>
          Project name
          <input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>
        <div className="two-fields">
          <label>
            Start date
            <input
              type="date"
              value={draft.startDate}
              onChange={(event) => patch({ startDate: event.target.value })}
            />
          </label>
          <label>
            Tentative end date
            <input
              type="date"
              value={draft.endDate}
              onChange={(event) => patch({ endDate: event.target.value })}
            />
          </label>
        </div>
        <label>
          Description / scope
          <textarea
            rows={5}
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </label>
        <label>
          Project administrator
          <select
            value={draft.adminId}
            onChange={(event) => patch({ adminId: event.target.value })}
          >
            <option value="">Select explicitly</option>
            {directory.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name || person.id}
              </option>
            ))}
          </select>
        </label>
        <section
          className="admin-create-team"
          aria-label="Project team assignments"
        >
          <h3>Team assignments</h3>
          {roles.map((role) => (
            <fieldset className="team-role-picker" key={role}>
              <legend>{roleDisplayLabel(role)}</legend>
              <details>
                <summary>
                  {draft.team
                    .filter((entry: any) => entry.roles.includes(role))
                    .map(
                      (entry: any) =>
                        directory.find((person) => person.id === entry.personId)
                          ?.name || entry.personId,
                    )
                    .join(", ") || "Unassigned"}
                </summary>
                <div className="team-role-options">
                  {role === "PM" && (
                    <label className="inline">
                      <input
                        type="radio"
                        name="settings-pm"
                        checked={
                          !draft.team.some((entry: any) =>
                            entry.roles.includes("PM"),
                          )
                        }
                        onChange={(event) => {
                          assign("PM", "", false);
                          event.currentTarget
                            .closest("details")
                            ?.removeAttribute("open");
                        }}
                      />
                      <span>Unassigned</span>
                    </label>
                  )}
                  {directory.map((person) => (
                    <label className="inline" key={person.id}>
                      <input
                        type={role === "PM" ? "radio" : "checkbox"}
                        name={role === "PM" ? "settings-pm" : undefined}
                        checked={draft.team.some(
                          (entry: any) =>
                            entry.personId === person.id &&
                            entry.roles.includes(role),
                        )}
                        onChange={(event) => {
                          assign(role, person.id, event.target.checked);
                          if (role === "PM")
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                        }}
                      />
                      <span>{person.name || person.id}</span>
                    </label>
                  ))}
                  {!directory.length && (
                    <p className="helper">No available people.</p>
                  )}
                </div>
              </details>
            </fieldset>
          ))}
        </section>
        <div className="inline">
          <button
            type="button"
            disabled={!changed}
            onClick={() => {
              setDraft(initial());
              setChanged(false);
            }}
          >
            Reset preview
          </button>
          <button
            type="button"
            className="primary"
            disabled
            title="Saving requires a connected backend"
          >
            Save changes
          </button>
        </div>
      </form>
    </section>
  );
}
