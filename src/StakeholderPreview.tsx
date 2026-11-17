import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Bell,
  ExternalLink,
  FolderKanban,
  Moon,
  Sun,
} from "lucide-react";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/600.css";
import "@fontsource/montserrat/700.css";
import "./styles.css";
import "./dashboard.css";
import "./admin-layout.css";
import "./admin-overview.css";
import "./admin-example-toggle.css";
import { BrandLogo } from "./BrandLogo";
import { SidebarCollapse } from "./SidebarCollapse";
import { ProjectTabIndicator } from "./ProjectTabIndicator";
import { AdminProjectProgress } from "./AdminOverview";
import { AdminAgentToolbox } from "./AdminAssistantPanel";
import { AdminAssistantDrawer } from "./AdminAssistantDrawer";
import { AssistantDraftProvider } from "./AssistantWorkspace";
import { AdminTeamPreview } from "./AdminTeamPreview";
import "./stakeholder-preview.css";

const PEOPLE = [
  {
    id: "stakeholder-preview-sam",
    name: "Sam Example",
    email: "sam@example.test",
  },
  {
    id: "stakeholder-preview-alex",
    name: "Alex Example",
    email: "alex@example.test",
  },
  {
    id: "stakeholder-preview-maya",
    name: "Maya Example",
    email: "maya@example.test",
  },
  {
    id: "stakeholder-preview-owen",
    name: "Owen Example",
    email: "owen@example.test",
  },
];
const PROJECT = {
  id: "stakeholder-preview-capacity",
  name: "Capacity Planning",
  projectVersion: "1.0",
  description: "A shared view of performance, capacity and delivery readiness.",
  startDate: "2027-01-05",
  endDate: "2027-06-30",
  projectProgressPercent: 40,
  projectStatus: "in_progress",
  projectUrl: "",
  projectStages: [
    { name: "Planning", status: "Complete" },
    { name: "Design", status: "In progress" },
    { name: "Implementation", status: "Not started" },
    { name: "QA", status: "Not started" },
    { name: "Release", status: "Not started" },
  ],
  team: [
    { personId: PEOPLE[0].id, roles: ["Stakeholder"] },
    { personId: PEOPLE[1].id, roles: ["Admin"] },
    { personId: PEOPLE[2].id, roles: ["UX Designer"] },
    { personId: PEOPLE[3].id, roles: ["Full Stack Development"] },
  ],
};
const TABS = [
  "Overview",
  "My Tasks",
  "Team",
  "Product Requirements",
  "Activity",
] as const;
type Tab = (typeof TABS)[number];
function Tools({ scope }: { scope: string }) {
  const rail = useRef<HTMLElement>(null),
    origin = useRef<HTMLElement | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const open = (name: string) => {
    origin.current = document.activeElement as HTMLElement;
    setTool(name);
  };
  return (
    <aside
      ref={rail}
      className={"admin-overview-rail" + (tool ? " has-chat-drawer" : "")}
      aria-label="Stakeholder AI tools"
    >
      <div className="admin-overview-rail-content" inert={tool !== null}>
        <AdminAgentToolbox onFocusChat={() => open("Chat")} onOpenTool={open} />
      </div>
      {tool && (
        <AdminAssistantDrawer
          rail={rail}
          tool={tool}
          context={{
            actorId: PEOPLE[0].id,
            projectId: PROJECT.id,
            projectName: PROJECT.name,
            roleLabel: "Stakeholder",
            scopeId: "stakeholder-preview-" + scope,
            scopeLabel: scope,
          }}
          onClose={() => {
            setTool(null);
            requestAnimationFrame(() => origin.current?.focus());
          }}
        />
      )}
    </aside>
  );
}
function PhaseProgress() {
  return (
    <div className="stakeholder-phases">
      <div className="inline spread">
        <h3>Project phases</h3>
        <strong>40%</strong>
      </div>
      <progress value={40} max={100} aria-label="Example project progress">
        40%
      </progress>
      <ol>
        {PROJECT.projectStages.map((stage) => (
          <li key={stage.name}>
            <strong>{stage.name}</strong>
            <span>{stage.status}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
function StakeholderApp() {
  const [screen, setScreen] = useState<"projects" | "project">("projects"),
    [tab, setTab] = useState<Tab>("Overview");
  const [dark, setDark] = useState(false),
    [query, setQuery] = useState(""),
    [question, setQuestion] = useState(0),
    [answers, setAnswers] = useState<string[]>(Array(10).fill(""));
  const [notice, setNotice] = useState("");
  const filled = answers.filter((value) => value.trim()).length;
  const open = (next: Tab = "Overview") => {
    setScreen("project");
    setTab(next);
    setNotice("");
  };
  const viewUrl = (() => {
    try {
      const url = new URL(PROJECT.projectUrl);
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  })();
  function survey() {
    return (
      <section
        className="panel padded stakeholder-survey"
        aria-label="Stakeholder questionnaire"
      >
        <div className="inline spread">
          <div>
            <h2>Project questionnaire</h2>
            <p className="muted">10 questions · wording to be defined</p>
          </div>
          <span className="status neutral">{filled}/10 drafted</span>
        </div>
        <progress
          max={10}
          value={question + 1}
          aria-label="Question position"
        />
        <p className="helper">Question {question + 1} of 10</p>
        <label>
          Question {question + 1} — content pending
          <textarea
            rows={7}
            value={answers[question]}
            placeholder="Try a local example answer. Final questions have not been defined."
            onChange={(event) =>
              setAnswers((values) =>
                values.map((value, index) =>
                  index === question ? event.target.value : value,
                ),
              )
            }
          />
        </label>
        <p className="helper">
          Answers stay in this preview session. Nothing is submitted or saved.
        </p>
        <div className="inline spread">
          <button
            disabled={question === 0}
            onClick={() => setQuestion((value) => value - 1)}
          >
            Previous
          </button>
          {question < 9 ? (
            <button
              className="primary"
              onClick={() => setQuestion((value) => value + 1)}
            >
              Next question
            </button>
          ) : (
            <button
              className="primary"
              onClick={() =>
                setNotice("Preview complete. No questionnaire was submitted.")
              }
            >
              Finish preview
            </button>
          )}
        </div>
        {notice && <p role="status">{notice}</p>}
      </section>
    );
  }
  let content: React.ReactNode;
  if (tab === "Overview")
    content = (
      <>
        <section className="panel padded">
          <h2>Project overview</h2>
          <p>{PROJECT.description}</p>
          <PhaseProgress />
          <div className="stakeholder-summary-grid">
            <div>
              <span className="helper">Target date</span>
              <strong>Jun 30, 2027</strong>
            </div>
            <div>
              <span className="helper">Current phase</span>
              <strong>Design</strong>
            </div>
            <div>
              <span className="helper">Attention needed</span>
              <strong className="stakeholder-warning">1 example blocker</strong>
            </div>
          </div>
          {viewUrl && (
            <a
              className="button primary"
              href={viewUrl}
              target="_blank"
              rel="noreferrer"
            >
              View Project <ExternalLink size={16} />
            </a>
          )}
        </section>
        <section className="panel padded">
          <h2>Blockers & decisions</h2>
          <div className="stakeholder-blocker">
            <span className="status stakeholder-warning">Awaiting input</span>
            <h3>Confirm example capacity targets</h3>
            <p className="muted">
              The next design milestone needs a clear peak-demand target.
            </p>
            <section className="panel padded inline spread stakeholder-questionnaire-card">
              <div>
                <h2>My questionnaire</h2>
                <p className="muted">
                  {filled} of 10 answers drafted in this session
                </p>
              </div>
              <button className="primary" onClick={() => open("My Tasks")}>
                {filled ? "Continue" : "Start"} questionnaire
              </button>
            </section>
            <div className="helper stakeholder-blocker-owner">
              Owner: Alex Example · Due March 18, 2027
            </div>
          </div>
        </section>
      </>
    );
  else if (tab === "My Tasks") content = survey();
  else if (tab === "Team")
    content = <AdminTeamPreview project={PROJECT} people={PEOPLE} />;
  else if (tab === "Product Requirements")
    content = (
      <section className="panel padded">
        <div className="inline spread">
          <h2>Product Requirements</h2>
          <span className="status neutral">Read only · example</span>
        </div>
        <h3>Capacity Planning · PRD preview</h3>
        <p className="muted">
          An illustrative reading view, not an approved requirements baseline.
        </p>
        <div className="example-snapshot">
          <h3>Purpose</h3>
          <p>
            Make project progress and capacity-planning decisions visible to
            stakeholders.
          </p>
        </div>
        <div className="example-snapshot">
          <h3>Scope</h3>
          <p>
            Project visibility, questionnaire inputs, team coordination and a
            shared requirements view.
          </p>
        </div>
        <div className="example-snapshot">
          <h3>Open questions</h3>
          <p>
            Final success measures, scope boundaries and requirements remain to
            be defined.
          </p>
        </div>
      </section>
    );
  else
    content = (
      <section className="panel padded">
        <h2>Activity</h2>
        <p className="muted">Illustrative project history · Times in UTC</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Person</th>
                <th>Event</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Mar 13, 2027 · 12:00</td>
                <td>Alex Example</td>
                <td>Example project moved to Design</td>
              </tr>
              <tr>
                <td>Mar 12, 2027 · 10:00</td>
                <td>Maya Example</td>
                <td>Example UX input added for review</td>
              </tr>
              <tr>
                <td>Jan 5, 2027 · 09:00</td>
                <td>Alex Example</td>
                <td>Example project created</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  return (
    <div className="app-shell stakeholder-preview-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <aside className="sidebar" id="primary-sidebar">
        <button
          className="brand"
          aria-label="Astra Systems home"
          onClick={() => setScreen("projects")}
        >
          <BrandLogo />
        </button>
        <nav aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          <button className="selected" onClick={() => setScreen("projects")}>
            <FolderKanban size={19} />
            Projects
          </button>
        </nav>
        <div className="sidebar-bottom">
          <SidebarCollapse />
          <div className="profile">
            <span className="avatar">SE</span>
            <span>
              <strong>Sam Example</strong>
              <small>Stakeholder</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <nav
            className="inline stakeholder-breadcrumb"
            aria-label="Breadcrumb"
          >
            <button onClick={() => setScreen("projects")}>
              Stakeholder Home
            </button>
            <span>›</span>
            <button onClick={() => setScreen("projects")}>Projects</button>
            {screen === "project" && (
              <>
                <span>›</span>
                <button onClick={() => open()}>{PROJECT.name}</button>
                <span>›</span>
                <span>{tab}</span>
              </>
            )}
          </nav>
          <div className="topbar-actions">
            <span className="status neutral">Isolated preview</span>
            <select
              aria-label="Interface language"
              value="en"
              onChange={() => {}}
            >
              <option value="en">English</option>
            </select>
            <button
              className="icon-button"
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              onClick={() => {
                document.documentElement.dataset.theme = dark
                  ? "light"
                  : "dark";
                setDark(!dark);
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button"
              aria-label="Notifications unavailable in preview"
              disabled
            >
              <Bell size={18} />
            </button>
            <span className="avatar">SE</span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>

          {screen === "projects" ? (
            <>
              <div className="page-heading inline spread">
                <div>
                  <h1>Your projects</h1>
                  <p className="muted">
                    Progress, decisions and your next steps.
                  </p>
                </div>
                <input
                  aria-label="Find projects"
                  placeholder="Find a project"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {PROJECT.name.toLowerCase().includes(query.toLowerCase()) ? (
                <article className="panel dashboard-card dashboard-card-admin stakeholder-project-card">
                  <header className="dashboard-admin-card-heading">
                    <h2>{PROJECT.name}</h2>
                    <div className="dashboard-admin-version-dates">
                      <strong className="dashboard-project-version">Version 1.0</strong>
                      <dl className="dashboard-admin-dates">
                        <div><dt>Start</dt><dd>Jan 5, 2027</dd></div>
                        <div><dt>Target</dt><dd>Jun 30, 2027</dd></div>
                      </dl>
                    </div>
                  </header>
                  <div
                    className="dashboard-team-avatars"
                    aria-label="Example project team"
                  >
                    {PEOPLE.map((person) => (
                      <span
                        className="avatar"
                        title={person.name}
                        key={person.id}
                      >
                        {person.name
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      </span>
                    ))}
                  </div>
                  <div className="dashboard-project-progress dashboard-progress-info">
                    <div className="dashboard-progress-heading"><span>Project progress</span><strong>40%</strong></div>
                    <progress value={40} max={100} aria-label="Example project progress">40%</progress>
                    <ol className="dashboard-project-stages" aria-label="Example project stages">
                      {PROJECT.projectStages.map((stage, index) => (
                        <li key={stage.name} className={`dashboard-stage-${index === 0 ? "success" : index === 1 ? "info" : "neutral"}`}>
                          <span>{stage.name}</span><strong>{stage.status}</strong>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <footer>
                    <span className="status stakeholder-warning">
                      1 item needs input
                    </span>
                    <button className="primary" onClick={() => open()}>
                      Open project
                    </button>
                  </footer>
                </article>
              ) : (
                <section className="panel padded">
                  No matching projects.
                </section>
              )}
            </>
          ) : (
            <>
              <button
                className="back-link"
                onClick={() => setScreen("projects")}
              >
                <ArrowLeft size={14} /> Back to projects
              </button>
              <div className="admin-overview-page-heading">
                <div className="page-heading">
                  <h1>{PROJECT.name}</h1>
                </div>
                <AdminProjectProgress p={PROJECT} />
              </div>
              <nav className="tabs" aria-label="Project navigation">
                <ProjectTabIndicator />
                {TABS.map((label) => (
                  <button
                    key={label}
                    aria-current={tab === label ? "page" : undefined}
                    onClick={() => {
                      setTab(label);
                      setNotice("");
                    }}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {tab === "Team" ? (
                content
              ) : (
                <div className="admin-overview-layout">
                  <div className="admin-project-content stakeholder-content-stack">
                    {content}
                  </div>
                  <Tools scope={tab} />
                </div>
              )}
            </>
          )}
        </main>
        <footer className="app-footer">
          Astra System · Owned and powered by WiseCursor
        </footer>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <AssistantDraftProvider actorId={PEOPLE[0].id}>
    <StakeholderApp />
  </AssistantDraftProvider>,
);
