import { useState } from "react";
import { adminCardProjectStatus } from "./admin-card-status";
import {
  dashboardTeam,
  recordedProjectProgress,
  recordedProjectStages,
  type AdminDashboardProject,
  type DashboardPerson,
} from "./admin-dashboard-model";
import {
  hasStakeholderContext,
  recordedDate,
  recordedPrdStatus,
  reviewCount,
  sourceReadiness,
  type DashboardProject,
} from "./dashboard-model";
import "./dashboard.css";

export type ProjectDashboardProps = {
  projects: AdminDashboardProject[];
  actorId: string;
  roles: string[];
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (project: DashboardProject, section: string) => void;
  people?: readonly DashboardPerson[];
  onOpenLogs?: () => void;
  displayMode?: "real" | "example";
};

function hoverProjectGlint(button: HTMLElement) {
  if (button.dataset.glintRunning) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  button.dataset.glintRunning = "true";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "project-card-glint");
  svg.setAttribute("aria-hidden", "true");
  const rect = document.createElementNS(svg.namespaceURI, "rect");
  rect.setAttribute("x", "0.5");
  rect.setAttribute("y", "0.5");
  rect.setAttribute("width", String(button.clientWidth - 1));
  rect.setAttribute("height", String(button.clientHeight - 1));
  rect.setAttribute(
    "rx",
    String(
      Math.max(0, parseFloat(getComputedStyle(button).borderRadius) - 0.5),
    ),
  );
  rect.setAttribute("pathLength", "100");
  svg.appendChild(rect);
  button.appendChild(svg);
  const glow = svg.cloneNode(true) as SVGElement;
  glow.setAttribute("class", "project-card-glint project-card-glow");
  button.appendChild(glow);
  const trail = svg.cloneNode(true) as SVGElement;
  trail.setAttribute("class", "project-card-glint project-card-trail");
  button.appendChild(trail);
  for (let index = 1; index <= 20; index += 1) {
    const segment = rect.cloneNode(true) as SVGElement;
    segment.setAttribute("class", "project-card-star-segment");
    segment.style.setProperty("--segment-offset", String(-index * 0.75));
    segment.style.setProperty("--segment-start", String(100 - index * 0.75));
    segment.style.stroke = `color-mix(in srgb, var(--astra-action-primary) ${index * 5}%, var(--astra-action-accent))`;
    svg.appendChild(segment);
  }
  window.setTimeout(() => {
    svg.remove();
    glow.remove();
    trail.remove();
    delete button.dataset.glintRunning;
  }, 3500);
}

function AdminProjectCard({
  project,
  people,
  onOpen,
}: {
  project: AdminDashboardProject;
  people: readonly DashboardPerson[];
  onOpen: ProjectDashboardProps["onOpen"];
}) {
  const pending = reviewCount(project);
  const status = adminCardProjectStatus(project);
  const team = dashboardTeam(project, people);
  const progress = recordedProjectProgress(project);
  const stages = recordedProjectStages(project);
  const projectVersion =
    typeof project.projectVersion === "string"
      ? project.projectVersion.trim()
      : typeof project.projectVersion === "number" &&
          Number.isFinite(project.projectVersion)
        ? String(project.projectVersion)
        : "";
  return (
    <article
      className="panel dashboard-card dashboard-card-compact dashboard-card-admin"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse")
          hoverProjectGlint(event.currentTarget);
      }}
      onPointerLeave={(event) => {
        event.currentTarget
          .querySelectorAll(".project-card-glint")
          .forEach((node) => node.remove());
      }}
    >
      <header className="dashboard-admin-card-heading">
        <h2>
          <button
            className="title-button"
            onClick={() => onOpen(project, "overview")}
          >
            {project.name}
          </button>
        </h2>
        <div className="dashboard-admin-version-dates">
          {projectVersion && (
            <strong className="dashboard-project-version">
              Version {projectVersion}
            </strong>
          )}
          <dl className="dashboard-admin-dates">
            <div>
              <dt>Start</dt>
              <dd>{recordedDate(project.startDate) || "Not recorded"}</dd>
            </div>
            <div>
              <dt>Tentative end</dt>
              <dd>{recordedDate(project.endDate) || "Not recorded"}</dd>
            </div>
          </dl>
        </div>
      </header>
      <div className="dashboard-team-status-band">
        <div className="dashboard-team">
          <span className="dashboard-field-label">Team</span>
          {team.length ? (
            <ul
              aria-label="Assigned project team"
              className="dashboard-team-avatars"
            >
              {team.map((member) => {
                const label = [
                  member.name || "Name not recorded",
                  ...member.roles,
                  ...(member.accountStatus
                    ? [`Account: ${member.accountStatus}`]
                    : []),
                ].join(" · ");
                return (
                  <li key={member.id}>
                    <span
                      className="dashboard-team-avatar"
                      title={label}
                      aria-hidden="true"
                    >
                      {member.initials || "—"}
                    </span>
                    <span className="sr-only">{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <strong className="dashboard-unrecorded">Not recorded</strong>
          )}
        </div>
      </div>
      <div
        className={`dashboard-project-progress dashboard-progress-${status.tone}`}
      >
        <div className="dashboard-progress-heading">
          <span>Project progress</span>
          <strong>{progress === null ? "Not recorded" : `${progress}%`}</strong>
        </div>
        {progress === null ? (
          <div className="dashboard-progress-unrecorded" aria-hidden="true" />
        ) : (
          <progress
            max={100}
            value={progress}
            aria-label={`${project.name}: recorded project progress`}
          >
            {progress}%
          </progress>
        )}
        {stages.length ? (
          <ol
            className="dashboard-project-stages"
            aria-label="Recorded project stages"
          >
            {stages.map((stage, index) => (
              <li key={index} className={`dashboard-stage-${stage.tone}`}>
                <span>{stage.name}</span>
                <strong>{stage.status}</strong>
              </li>
            ))}
          </ol>
        ) : (
          <p className="dashboard-stages-unrecorded">
            Stages <strong>Not recorded</strong>
          </p>
        )}
      </div>
      <footer>
        <button
          type="button"
          className="dashboard-review-button"
          onClick={() => onOpen(project, "reviews")}
          aria-label={`${project.name}: pending reviews${pending === null ? ", count not recorded" : `, ${pending}`}`}
        >
          {pending === null ? (
            <>
              Pending reviews <span>Not recorded</span>
            </>
          ) : (
            <>
              {pending} pending {pending === 1 ? "review" : "reviews"}
            </>
          )}
        </button>
        <button
          type="button"
          className="primary dashboard-open-project"
          onClick={() => onOpen(project, "overview")}
        >
          Open project
        </button>
      </footer>
    </article>
  );
}

export function ProjectDashboard({
  projects,
  actorId,
  roles,
  canCreate,
  onCreate,
  onOpen,
  people = [],
  onOpenLogs,
  displayMode = "real",
}: ProjectDashboardProps) {
  const [query, setQuery] = useState("");
  const visible = projects.filter((project) =>
    project.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const stakeholder = roles.includes("Stakeholder");
  const adminDashboard = canCreate || roles.includes("Admin");
  const example = displayMode === "example";
  return (
    <section
      className={`project-dashboard${adminDashboard ? " project-dashboard-admin" : ""}`}
      aria-label="Project dashboard"
    >
      <div className="page-heading">
        <div>
          {!adminDashboard && <p className="eyebrow">WORKSPACE</p>}
          <h1>
            {adminDashboard
              ? "Your projects"
              : stakeholder
                ? "Project dashboard"
                : "Your projects"}
          </h1>
          <p>
            {adminDashboard
              ? "Select a project to view its details and team."
              : "Keep the work, the evidence and the next conversation together."}
          </p>
        </div>
        <div className="dashboard-header-actions">
          {adminDashboard && (
            <div className="dashboard-heading-search">
              <label className="search">
                <span className="sr-only">Search projects</span>
                <input
                  aria-label="Search projects"
                  placeholder="Find a project"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <span className="muted">{visible.length} shown</span>
            </div>
          )}
          {adminDashboard && onOpenLogs && (
            <button type="button" onClick={onOpenLogs}>
              Open Logs
            </button>
          )}
          {(canCreate || (adminDashboard && example)) && (
            <button
              type="button"
              className="primary"
              disabled={example}
              onClick={example ? undefined : onCreate}
            >
              Create project
            </button>
          )}
        </div>
      </div>
      {!adminDashboard && (
        <div className="dashboard-summary">
          <div>
            <strong>{projects.length}</strong>
            <span>Accessible projects</span>
          </div>
          <div>
            <strong>
              {
                projects.filter(
                  (p) =>
                    p.questionnaire?.assignedTo === actorId &&
                    ["draft", "in_progress"].includes(
                      p.questionnaire?.status || "",
                    ),
                ).length
              }
            </strong>
            <span>Questionnaires awaiting your input</span>
          </div>
          <p>
            {example
              ? "These projects and assignments are fictional."
              : "Only projects assigned to your verified account appear here."}
          </p>
        </div>
      )}
      {!adminDashboard && (
        <div className="list-toolbar">
          <label className="search">
            <span className="sr-only">Search projects</span>
            <input
              aria-label="Search projects"
              placeholder="Find a project"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <span className="muted">{visible.length} shown</span>
        </div>
      )}
      <div
        className={`dashboard-grid${adminDashboard ? " dashboard-grid-admin" : ""}`}
      >
        {visible.map((project) => {
          if (adminDashboard && project.isAdmin === true)
            return (
              <AdminProjectCard
                key={project.id}
                project={project}
                people={people}
                onOpen={onOpen}
              />
            );
          const pending = reviewCount(project);
          return (
            <article className="panel dashboard-card" key={project.id}>
              <header>
                <span className="eyebrow">PROJECT</span>
                <span className="status neutral">
                  PRD · {recordedPrdStatus(project)}
                </span>
              </header>
              <h2>
                <button
                  className="title-button"
                  onClick={() => onOpen(project, "overview")}
                >
                  {project.name}
                </button>
              </h2>
              <p className="dashboard-description">
                {project.description || "No project description recorded."}
              </p>
              <dl className="dashboard-dates">
                <div>
                  <dt>Start date</dt>
                  <dd>{recordedDate(project.startDate) || "Not set"}</dd>
                </div>
                <div>
                  <dt>Tentative end</dt>
                  <dd>{recordedDate(project.endDate) || "Not set"}</dd>
                </div>
              </dl>
              <div className="dashboard-evidence">
                <span>PRD sources</span>
                <strong>{sourceReadiness(project)}</strong>
                <small>
                  This is document readiness, not overall project progress.
                </small>
              </div>
              <div className="dashboard-stage">
                <span>Project stage</span>
                <strong>Not recorded</strong>
                <small>Stage tracking is not available yet.</small>
              </div>
              {pending !== null && (
                <button
                  className="text-button"
                  onClick={() => onOpen(project, "reviews")}
                >
                  {pending} deliveries need review
                </button>
              )}
              {project.questionnaire?.assignedTo === actorId && (
                <button
                  className="text-button"
                  onClick={() => onOpen(project, "questionnaire")}
                >
                  {project.questionnaire.status === "submitted"
                    ? "View submitted questionnaire"
                    : "Continue questionnaire"}
                </button>
              )}
              <footer>
                <button
                  className="primary"
                  onClick={() =>
                    onOpen(project, project.isAdmin ? "overview" : "assistant")
                  }
                >
                  {project.isAdmin ? "Open project" : "Open assistant"}
                </button>
                {!project.isAdmin &&
                  hasStakeholderContext(project, actorId) && (
                    <button onClick={() => onOpen(project, "wireframe")}>
                      Quick wireframe
                    </button>
                  )}
                {!project.isAdmin && (
                  <button
                    className="text-button"
                    onClick={() => onOpen(project, "overview")}
                  >
                    View project
                  </button>
                )}
              </footer>
            </article>
          );
        })}
      </div>
      {!visible.length && (
        <div className="empty">
          <h2>
            {projects.length ? "No matching projects" : "No assigned projects"}
          </h2>
          <p>
            {projects.length
              ? "Try another project name."
              : canCreate && !example
                ? "Create a project to get started."
                : example
                  ? "No example projects provided."
                  : "Ask your project administrator to assign you to a project."}
          </p>
        </div>
      )}
      {!adminDashboard && (
        <p className="dashboard-limit">
          Stage, risk and budget data are not recorded in the current workspace.
          Missing information is not treated as zero or as completed work.
        </p>
      )}
    </section>
  );
}
