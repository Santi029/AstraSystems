import { AdminReviewPreviewActions } from "./AdminReviewPreviewActions";
import { AdminProjectSettings } from "./AdminProjectSettings";
import type { AdminSourceRecord } from "./admin-view-model";
import { AdminMyTasks } from "./AdminMyTasks";
import { ProjectTabIndicator } from "./ProjectTabIndicator";
import {
  SourceDocumentPreviewLink,
  SourceSubmissionDate,
} from "./SourceDocumentPreviewLink";
import { AdminTeamPreview } from "./AdminTeamPreview";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AdminOverview,
  AdminProjectProgress,
  AdminProjectToolsRail,
} from "./AdminOverview";
import { AdminDeliverables } from "./AdminDeliverables";
import { ProjectDashboard } from "./ProjectDashboard";
import { dashboardTeam } from "./admin-dashboard-model";
import type { DashboardProject } from "./dashboard-model";
import { AdminActivity } from "./AdminActivity";
import { AdminAssistantPanel } from "./AdminAssistantPanel";
import {
  AssistantDraftProvider,
  useAssistantDraftSession,
} from "./AssistantWorkspace";
import { deliveryStatus, recordedInstant } from "./admin-view-model";
import "./admin-layout.css";
import "./admin-example.css";

const EXAMPLE_ACTOR = "astra-example-admin";
const EXAMPLE_PROJECT_ID = "astra-example-capacity-planning";
const SECTIONS = [
  ["overview", "Overview"],
  ["tasks", "My Tasks"],
  ["reviews", "Deliverables"],
  ["team", "Team"],
  ["prd", "Product Requirements"],
  ["audit", "Activity"],
  ["settings", "Settings"],
] as const;
type Section = (typeof SECTIONS)[number][0];
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Literal fictional data only. Never load, clone, merge or mutate the user's state.
const EXAMPLE_PEOPLE = freeze([
  {
    id: EXAMPLE_ACTOR,
    name: "Alex Example",
    email: "admin@example.test",
    roles: ["Admin"],
  },
  {
    id: "astra-example-ux",
    name: "Maya Example",
    email: "ux-specialist@example.test",
    roles: ["UX Designer"],
  },
  {
    id: "astra-example-architecture",
    name: "Owen Example",
    email: "architecture-specialist@example.test",
    roles: ["Architecture"],
  },
  {
    id: "astra-example-qa",
    name: "Quinn Example",
    email: "qa-specialist@example.test",
    roles: ["QA"],
  },
  {
    id: "astra-example-development",
    name: "Devon Example",
    email: "development@example.test",
    roles: ["Full Stack Development"],
  },
  {
    id: "astra-example-stakeholder",
    name: "Sam Example",
    email: "stakeholder@example.test",
    roles: ["Stakeholder"],
  },
  {
    id: "astra-example-pilot-specialist",
    name: "Jordan Example",
    email: "pilot-specialist@example.test",
    roles: ["UX Designer", "QA"],
  },
]);
const EXAMPLE_PROJECT = freeze({
  id: EXAMPLE_PROJECT_ID,
  name: "Capacity Planning",
  projectVersion: "1.0",
  description: "",
  projectStatus: "in_progress",
  startDate: "2027-01-05",
  endDate: "2027-06-30",
  isAdmin: true,
  adminIds: [EXAMPLE_ACTOR],
  projectProgressPercent: 40,
  projectStages: [
    { id: "setup", name: "Setup", status: "complete" },
    { id: "waiting", name: "Waiting for Deliverables", status: "complete" },
    { id: "implementation", name: "Implementation", status: "in_progress" },
    { id: "validation", name: "Validation", status: "not_started" },
    { id: "closure", name: "Closure", status: "not_started" },
  ],
  team: [
    { personId: "astra-example-ux", roles: ["UX Designer"] },
    { personId: "astra-example-architecture", roles: ["Architecture"] },
    { personId: "astra-example-qa", roles: ["QA"] },
  ],
  tasks: [],
  summary: { needsReview: 2 },
  requiredSourceIds: [
    "example-research",
    "example-architecture",
    "example-qa",
    "example-flows",
  ],
  documents: [
    {
      id: "example-research",
      title: "Research notes · Example",
      ownerId: "astra-example-ux",
      workingVersion: null,
      versions: [
        {
          version: 2,
          status: "submitted",
          content:
            "FICTIONAL EXAMPLE\nA sample team wants to make review handoffs easier to follow. These are illustrative notes, not user research.",
        },
      ],
    },
    {
      id: "example-goals",
      title: "Experience goals · Example",
      ownerId: "astra-example-ux",
      workingVersion: null,
      versions: [
        {
          version: 1,
          status: "submitted",
          content:
            "FICTIONAL EXAMPLE\nShow the author, included document versions and review status clearly. This is sample content, not an approved requirement.",
        },
      ],
    },
    {
      id: "example-architecture",
      title: "Architecture notes · Example",
      ownerId: "astra-example-architecture",
      workingVersion: null,
      versions: [
        {
          version: 1,
          status: "submitted",
          content:
            "FICTIONAL EXAMPLE\nSeparate draft editing from immutable submitted snapshots. No deployed architecture is described by this example.",
        },
      ],
    },
    {
      id: "example-qa",
      title: "Review checklist · Example",
      ownerId: "astra-example-qa",
      workingVersion: null,
      versions: [
        {
          version: 1,
          status: "approved",
          approvedAt: "2027-03-12T16:00:00.000Z",
          savedAt: "2027-03-12T14:00:00.000Z",
          content:
            "FICTIONAL EXAMPLE\nCheck author labels, exact versions and recorded timestamps. This example approval is not a real testing result.",
        },
      ],
    },
    {
      id: "example-flows",
      title: "Navigation flow · Example",
      ownerId: "astra-example-ux",
      workingVersion: 4,
      versions: [
        {
          version: 3,
          status: "returned",
          content:
            "FICTIONAL EXAMPLE\nProject overview → Deliverables → Read-only submission detail. The example reviewer requested clearer return navigation.",
        },
        {
          version: 4,
          status: "draft",
          content:
            "FICTIONAL EXAMPLE\nA later working draft. It is not part of the submitted v3 package.",
        },
      ],
    },
  ],
  deliveries: [
    {
      id: "example-delivery-pending",
      title: "Discovery handoff · Example",
      version: 2,
      status: "submitted",
      submittedBy: "astra-example-ux",
      submittedAt: "2027-03-13T12:00:00.000Z",
      feedback: "",
      documentVersions: [
        {
          documentId: "example-research",
          title: "Research notes · Example",
          version: 2,
          content:
            "FICTIONAL EXAMPLE\nA sample team wants to make review handoffs easier to follow. These are illustrative notes, not user research.",
        },
        {
          documentId: "example-goals",
          title: "Experience goals · Example",
          version: 1,
          content:
            "FICTIONAL EXAMPLE\nShow the author, included document versions and review status clearly. This is sample content, not an approved requirement.",
        },
      ],
      history: [
        {
          action: "submitted",
          actorId: "astra-example-ux",
          at: "2027-03-13T12:00:00.000Z",
        },
      ],
    },
    {
      id: "example-delivery-review",
      title: "Architecture handoff · Example",
      version: 1,
      status: "under_review",
      submittedBy: "astra-example-architecture",
      submittedAt: "2027-03-13T10:00:00.000Z",
      feedback: "",
      documentVersions: [
        {
          documentId: "example-architecture",
          title: "Architecture notes · Example",
          version: 1,
          content:
            "FICTIONAL EXAMPLE\nSeparate draft editing from immutable submitted snapshots. No deployed architecture is described by this example.",
        },
      ],
      history: [
        {
          action: "submitted",
          actorId: "astra-example-architecture",
          at: "2027-03-13T10:00:00.000Z",
        },
        {
          action: "openReview",
          actorId: EXAMPLE_ACTOR,
          at: "2027-03-13T10:15:00.000Z",
        },
      ],
    },
    {
      id: "example-delivery-approved",
      title: "Quality checklist · Example",
      version: 1,
      status: "approved",
      submittedBy: "astra-example-qa",
      submittedAt: "2027-03-12T15:00:00.000Z",
      reviewedBy: EXAMPLE_ACTOR,
      reviewedAt: "2027-03-12T16:00:00.000Z",
      feedback: "",
      documentVersions: [
        {
          documentId: "example-qa",
          title: "Review checklist · Example",
          version: 1,
          content:
            "FICTIONAL EXAMPLE\nCheck author labels, exact versions and recorded timestamps. This example approval is not a real testing result.",
        },
      ],
      history: [
        {
          action: "submitted",
          actorId: "astra-example-qa",
          at: "2027-03-12T15:00:00.000Z",
        },
        {
          action: "approveDelivery",
          actorId: EXAMPLE_ACTOR,
          at: "2027-03-12T16:00:00.000Z",
        },
      ],
    },
    {
      id: "example-delivery-returned",
      title: "Navigation proposal · Example",
      version: 3,
      status: "returned",
      submittedBy: "astra-example-ux",
      submittedAt: "2027-03-11T13:00:00.000Z",
      reviewedBy: EXAMPLE_ACTOR,
      reviewedAt: "2027-03-11T13:30:00.000Z",
      feedback:
        "Fictional feedback: clarify how the reader returns to all deliverables.",
      documentVersions: [
        {
          documentId: "example-flows",
          title: "Navigation flow · Example",
          version: 3,
          content:
            "FICTIONAL EXAMPLE\nProject overview → Deliverables → Read-only submission detail. The example reviewer requested clearer return navigation.",
        },
      ],
      history: [
        {
          action: "submitted",
          actorId: "astra-example-ux",
          at: "2027-03-11T13:00:00.000Z",
        },
        {
          action: "returnDelivery",
          actorId: EXAMPLE_ACTOR,
          at: "2027-03-11T13:30:00.000Z",
          reason:
            "Fictional feedback: clarify how the reader returns to all deliverables.",
        },
      ],
    },
  ],
  prd: {
    version: 1,
    status: "draft",
    approvedSources: 1,
    totalSources: 4,
    readiness: { approved: 1, total: 4 },
    preparedAt: "2027-03-13T12:30:00.000Z",
    sourceVersions: [
      { documentId: "example-research", version: 2, status: "submitted" },
      { documentId: "example-architecture", version: 1, status: "submitted" },
      { documentId: "example-qa", version: 1, status: "approved" },
      { documentId: "example-flows", version: 4, status: "draft" },
    ],
    content:
      "ILLUSTRATIVE PRD · FICTIONAL DATA ONLY\n\nPurpose\nExplore a sample Admin review workflow with clearly separated draft, submission and review states.\n\nExample scope\nA project overview, exact delivery snapshots, a read-only team list and a recorded activity table.\n\nNot a real commitment\nThis draft does not define actual product requirements, delivery dates, research findings or acceptance criteria. No source approval or PRD closure can be performed in this example.",
  },
  audit: [
    {
      id: "example-event-create",
      at: "2027-01-05T09:00:00.000Z",
      actorId: EXAMPLE_ACTOR,
      action: "createProject",
      details: {
        projectId: EXAMPLE_PROJECT_ID,
        administrator: EXAMPLE_ACTOR,
        fictional: true,
      },
    },
    {
      id: "example-event-flow-submit",
      at: "2027-03-11T13:00:00.000Z",
      actorId: "astra-example-ux",
      action: "submitDocuments",
      details: {
        deliveryId: "example-delivery-returned",
        version: 3,
        documentVersions: [
          {
            documentId: "example-flows",
            title: "Navigation flow · Example",
            version: 3,
          },
        ],
      },
    },
    {
      id: "example-event-flow-return",
      at: "2027-03-11T13:30:00.000Z",
      actorId: EXAMPLE_ACTOR,
      action: "returnDelivery",
      details: {
        deliveryId: "example-delivery-returned",
        version: 3,
        status: "returned",
      },
    },
    {
      id: "example-event-qa-submit",
      at: "2027-03-12T15:00:00.000Z",
      actorId: "astra-example-qa",
      action: "submitDocuments",
      details: {
        deliveryId: "example-delivery-approved",
        version: 1,
        documentVersions: [
          {
            documentId: "example-qa",
            title: "Review checklist · Example",
            version: 1,
          },
        ],
      },
    },
    {
      id: "example-event-qa-approve",
      at: "2027-03-12T16:00:00.000Z",
      actorId: EXAMPLE_ACTOR,
      action: "approveDelivery",
      details: {
        deliveryId: "example-delivery-approved",
        version: 1,
        status: "approved",
      },
    },
    {
      id: "example-event-architecture-submit",
      at: "2027-03-13T10:00:00.000Z",
      actorId: "astra-example-architecture",
      action: "submitDocuments",
      details: {
        deliveryId: "example-delivery-review",
        version: 1,
        documentVersions: [
          {
            documentId: "example-architecture",
            title: "Architecture notes · Example",
            version: 1,
          },
        ],
      },
    },
    {
      id: "example-event-review",
      at: "2027-03-13T10:15:00.000Z",
      actorId: EXAMPLE_ACTOR,
      action: "openReview",
      details: {
        deliveryId: "example-delivery-review",
        version: 1,
        status: "under_review",
      },
    },
    {
      id: "example-event-discovery-submit",
      at: "2027-03-13T12:00:00.000Z",
      actorId: "astra-example-ux",
      action: "submitDocuments",
      details: {
        deliveryId: "example-delivery-pending",
        version: 2,
        documentVersions: [
          {
            documentId: "example-research",
            title: "Research notes · Example",
            version: 2,
          },
          {
            documentId: "example-goals",
            title: "Experience goals · Example",
            version: 1,
          },
        ],
      },
    },
    {
      id: "example-event-prd",
      at: "2027-03-13T12:30:00.000Z",
      actorId: EXAMPLE_ACTOR,
      action: "preparePrd",
      details: {
        version: 1,
        readiness: { approved: 1, total: 4 },
        fictional: true,
      },
    },
  ],
});

// One isolated example only. Never substitute, delete or filter real projects.
const EXAMPLE_PROJECTS = freeze([EXAMPLE_PROJECT]);
type ExampleProject = Omit<(typeof EXAMPLE_PROJECTS)[number], "tasks"> & {
  tasks: AdminSourceRecord[];
};
const findExampleProject = (id: string) =>
  EXAMPLE_PROJECTS.find((project) => project.id === id);

const personName = (id: string) =>
  EXAMPLE_PEOPLE.find((person) => person.id === id)?.name ??
  "Name not recorded";
const documentTitle = (p: ExampleProject, id: string) =>
  p.documents.find((document) => document.id === id)?.title ??
  "Document title not recorded";

function ExampleAssistantRail({ p }: { p: ExampleProject }) {
  return (
    <AdminProjectToolsRail
      p={p}
      actorId={EXAMPLE_ACTOR}
      personName={personName}
      draftScopeId="example-project"
      scopeLabel="Deliverable review"
    />
  );
}
function ExampleProjectPage({
  p,
  section,
  onSection,
  onOpenDelivery,
  onAddSelectedTasks,
}: {
  p: ExampleProject;
  section: Section;
  onSection: (section: Section) => void;
  onOpenDelivery: (id: string) => void;
  onAddSelectedTasks?: (titles: readonly string[]) => void;
}) {
  if (section === "overview")
    return (
      <>
        <AdminOverview
          p={p}
          actorId={EXAMPLE_ACTOR}
          personName={personName}
          draftScopeId="example-project"
          onOpenDelivery={(delivery) => {
            if (typeof delivery.id === "string") onOpenDelivery(delivery.id);
          }}
          onViewAll={() => onSection("reviews")}
        />
      </>
    );
  let body;
  if (section === "settings")
    body = (
      <AdminProjectSettings
        key={p.id}
        project={p}
        people={[...EXAMPLE_PEOPLE]}
      />
    );
  else if (section === "tasks")
    body = (
      <AdminMyTasks
        p={p}
        actorId={EXAMPLE_ACTOR}
        personName={personName}
        onAddSelectedTasks={onAddSelectedTasks}
      />
    );
  else if (section === "reviews")
    body = (
      <AdminDeliverables
        p={p}
        personName={personName}
        onOpenDelivery={(delivery) => {
          if (typeof delivery.id === "string") onOpenDelivery(delivery.id);
        }}
      />
    );
  else if (section === "team")
    body = <AdminTeamPreview key={p.id} project={p} people={EXAMPLE_PEOPLE} />;
  else if (section === "prd")
    body = (
      <>
        <section className="panel padded">
          <div className="inline spread">
            <h2>Product Requirements · v{p.prd.version}</h2>
            <span className="status neutral">
              {p.prd.status === "closed" ? "Closed" : "Draft"}
            </span>
          </div>
          <p>Prepared at: {recordedInstant(p.prd.preparedAt).label}</p>
          <h3>Source versions</h3>
          <ul>
            {p.prd.sourceVersions.map((source) => (
              <li key={source.documentId} className="prd-source-version-row">
                <div>
                  <SourceDocumentPreviewLink
                    title={documentTitle(p, source.documentId)}
                  />{" "}
                  · v{source.version} ·{" "}
                  {source.status === "draft"
                    ? "Draft"
                    : deliveryStatus(source.status).label}
                </div>
                <SourceSubmissionDate
                  project={p}
                  documentId={source.documentId}
                  version={source.version}
                />
              </li>
            ))}
          </ul>
        </section>
        <section
          className="panel padded prd-preview-placeholder"
          aria-label="PRD Preview"
        >
          <h2>PRD Preview Coming Soon</h2>
          <p className="muted">
            A future template will display the PRD here for review and analysis.
          </p>
        </section>
      </>
    );
  else body = <AdminActivity p={p} personName={personName} />;
  if (section === "reviews" || section === "team") return body;
  return (
    <div className="admin-overview-layout">
      <div className="admin-project-content">{body}</div>
      <AdminProjectToolsRail
        p={p}
        actorId={EXAMPLE_ACTOR}
        personName={personName}
        draftScopeId="example-project"
        scopeLabel={SECTIONS.find(([key]) => key === section)?.[1] ?? "Project"}
      />
    </div>
  );
}
function ExampleDeliveryDetail({
  p,
  deliveryId,
  onBack,
}: {
  p: ExampleProject;
  deliveryId: string;
  onBack: () => void;
}) {
  const delivery = p.deliveries.find((item) => item.id === deliveryId);
  return (
    <div className="delivery-detail-stack">
      <section className="panel padded delivery-document-panel">
        <div className="inline spread delivery-back-status">
          <button type="button" className="back-link" onClick={onBack}>
            <span aria-hidden="true">←</span> Back to deliverables
          </button>
          {delivery && (
            <span
              className={
                delivery.status === "submitted"
                  ? "status delivery-pending-review"
                  : "status neutral"
              }
            >
              {deliveryStatus(delivery.status).label}
            </span>
          )}
        </div>
        {!delivery ? (
          <p>Delivery not found.</p>
        ) : (
          <>
            <div className="inline spread">
              <h2>
                {delivery.title} · v{delivery.version}
              </h2>
            </div>
            <p>Submitted by: {personName(delivery.submittedBy)}</p>
            <p>Submitted at: {recordedInstant(delivery.submittedAt).label}</p>
            {delivery.feedback && (
              <p className="feedback-box">{delivery.feedback}</p>
            )}
            {delivery.documentVersions.map((document) => (
              <article className="example-snapshot" key={document.documentId}>
                <h3>
                  {document.title} · v{document.version}
                </h3>
                <p>{document.content}</p>
              </article>
            ))}
          </>
        )}
      </section>
      {delivery && (
        <div className="delivery-review-outside">
          <AdminReviewPreviewActions />
          <h3>Review history</h3>
          <ul>
            {delivery.history.map((event, index) => (
              <li key={index}>
                {recordedInstant(event.at).label} · {personName(event.actorId)}{" "}
                ·{" "}
                {
                  (
                    {
                      submitted: "Submitted",
                      openReview: "Review started",
                      approveDelivery: "Approved",
                      returnDelivery: "Changes requested",
                    } as Record<string, string>
                  )[event.action]
                }
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
function ExampleDeliveryPage({
  p,
  deliveryId,
  onBack,
}: {
  p: ExampleProject;
  deliveryId: string;
  onBack: () => void;
}) {
  return (
    <div className="admin-overview-layout">
      <div className="admin-project-content">
        <ExampleDeliveryDetail p={p} deliveryId={deliveryId} onBack={onBack} />
      </div>
      <ExampleAssistantRail p={p} />
    </div>
  );
}
function ExampleDashboard({
  onOpen,
  onOpenLogs,
}: {
  onOpen: (project: ExampleProject, section: Section) => void;
  onOpenLogs: () => void;
}) {
  return (
    <ProjectDashboard
      projects={EXAMPLE_PROJECTS}
      people={EXAMPLE_PEOPLE}
      actorId={EXAMPLE_ACTOR}
      roles={["Admin"]}
      canCreate={false}
      displayMode="example"
      onCreate={() => {}}
      onOpenLogs={onOpenLogs}
      onOpen={(project: DashboardProject, section: string) => {
        const local = findExampleProject(project.id);
        if (local)
          onOpen(local, section === "reviews" ? "reviews" : "overview");
      }}
    />
  );
}
function ExampleLogs() {
  return (
    <section aria-label="Activity logs">
      <h1>Activity logs</h1>
      {EXAMPLE_PROJECTS.map((p) => (
        <section key={p.id} className="admin-overview">
          <h2>{p.name}</h2>
          <AdminActivity p={p} personName={personName} />
        </section>
      ))}
    </section>
  );
}
function ExampleBody() {
  const [screen, setScreen] = useState<
    "dashboard" | "project" | "delivery" | "logs"
  >("dashboard");
  const [projectId, setProjectId] = useState(EXAMPLE_PROJECT.id);
  const baseProject = findExampleProject(projectId) ?? EXAMPLE_PROJECT;
  const [sessionTasks, setSessionTasks] = useState<
    Record<string, AdminSourceRecord[]>
  >({});
  const p = useMemo(
    () => ({
      ...baseProject,
      tasks: [...baseProject.tasks, ...(sessionTasks[projectId] ?? [])],
    }),
    [baseProject, sessionTasks, projectId],
  );
  const addSelectedTasks = (titles: readonly string[]) =>
    setSessionTasks((current) => {
      const existing = current[projectId] ?? [];
      const unique = [...new Set(titles)].filter(
        (title) => !existing.some((task) => task.title === title),
      );
      return {
        ...current,
        [projectId]: [
          ...existing,
          ...unique.map((title, index) => ({
            id:
              "demo-session-task-" +
              projectId +
              "-" +
              (existing.length + index),
            ownerId: EXAMPLE_ACTOR,
            title,
            status: "not_started",
            description: "Demo session task. Not saved.",
            createdAt: "2027-03-13T09:00:00Z",
            updatedAt: "2027-03-14T15:30:00Z",
            exampleDates: true,
          })),
        ],
      };
    });
  const [section, setSection] = useState<Section>("overview");
  const [deliveryId, setDeliveryId] = useState("");
  const openSection = (next: Section) => {
    setSection(next);
    setScreen("project");
  };
  const openDelivery = (id: string) => {
    if (!p.deliveries.some((delivery) => delivery.id === id)) return;
    setDeliveryId(id);
    setScreen("delivery");
  };
  useEffect(() => {
    const publish = () =>
      window.dispatchEvent(
        new CustomEvent("astra-example-location", {
          detail: { screen, projectName: p.name, section },
        }),
      );
    const navigate = (event: Event) => {
      if ((event as CustomEvent).detail === "projects") setScreen("dashboard");
      else openSection("overview");
    };
    window.addEventListener("astra-example-location-request", publish);
    window.addEventListener("astra-example-navigate", navigate);
    publish();
    return () => {
      window.removeEventListener("astra-example-location-request", publish);
      window.removeEventListener("astra-example-navigate", navigate);
    };
  }, [screen, p.name, section]);
  return (
    <div className="admin-example-preview">
      {screen === "dashboard" ? (
        <ExampleDashboard
          onOpen={(project, next) => {
            setProjectId(project.id);
            setDeliveryId("");
            openSection(next);
          }}
          onOpenLogs={() => setScreen("logs")}
        />
      ) : screen === "logs" ? (
        <>
          <button
            type="button"
            className="back-link"
            onClick={() => setScreen("dashboard")}
          >
            <span aria-hidden="true">←</span> Back to dashboard
          </button>
          <ExampleLogs />
        </>
      ) : (
        <>
          <button
            type="button"
            className="back-link"
            onClick={() => setScreen("dashboard")}
          >
            <span aria-hidden="true">←</span> Back to dashboard
          </button>
          <div className={"admin-overview-page-heading"}>
            <div className="page-heading">
              <div>
                <h1>{p.name}</h1>
              </div>
            </div>
            {<AdminProjectProgress p={p} />}
          </div>
          <nav className="tabs" aria-label="Project navigation">
            <ProjectTabIndicator />
            {SECTIONS.map(([key, label]) => (
              <button
                type="button"
                key={key}
                aria-current={
                  screen === "project" && section === key ? "page" : undefined
                }
                onClick={() => openSection(key)}
              >
                {label}
              </button>
            ))}
          </nav>
          {screen === "delivery" ? (
            <ExampleDeliveryPage
              p={p}
              deliveryId={deliveryId}
              onBack={() => openSection("reviews")}
            />
          ) : (
            <ExampleProjectPage
              p={p}
              section={section}
              onSection={openSection}
              onAddSelectedTasks={addSelectedTasks}
              onOpenDelivery={openDelivery}
            />
          )}
        </>
      )}
    </div>
  );
}
type ExamplePreviewProps = {
  onDraftsChange?: (hasDrafts: boolean) => void;
};
/** Reports only draft presence, never message content. Parent confirms before unmounting. */
function ExampleDraftReporter({ onDraftsChange }: ExamplePreviewProps) {
  const { hasDrafts } = useAssistantDraftSession();
  const notify = useRef(onDraftsChange);
  notify.current = onDraftsChange;
  useEffect(() => {
    onDraftsChange?.(hasDrafts);
  }, [hasDrafts, onDraftsChange]);
  useEffect(() => () => notify.current?.(false), []);
  return null;
}
/**
 * Parent gates mounting to Admin. This actor ID is only a local draft namespace,
 * never an authentication identity. Unmount only after any requested discard confirmation.
 */
export function AdminExamplePreview({
  onDraftsChange,
}: ExamplePreviewProps = {}) {
  return (
    <AssistantDraftProvider actorId={EXAMPLE_ACTOR}>
      <ExampleDraftReporter onDraftsChange={onDraftsChange} />
      <ExampleBody />
    </AssistantDraftProvider>
  );
}
