import { AdminOwnTasksPanel } from "./AdminOwnTasksPanel";
import { AdminReviewActions } from "./AdminReviewActions";
import { prepareReviewDecision } from "./admin-review-action";
import { createReleasedBackendContract } from "./document-policy-release";
import { DocumentEditPermission } from "./DocumentEditPermission";
import { specialistAssignedTasks, specialistSelection, specialistDocumentAction } from "./specialist-work-model";
import { StakeholderQuestionnaire } from "./StakeholderQuestionnaire";
import { StakeholderOverview } from "./StakeholderOverview";
import { AdminProjectSettings } from "./AdminProjectSettings";
import { AdminMyTasks } from "./AdminMyTasks";
import { ProjectTabIndicator } from "./ProjectTabIndicator";
import { AdminBreadcrumb } from "./AdminBreadcrumb";
import { SidebarCollapse } from "./SidebarCollapse";
import {
  SourceDocumentPreviewLink,
  SourceSubmissionDate,
} from "./SourceDocumentPreviewLink";
import { AdminTeamPreview } from "./AdminTeamPreview";
import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Users,
  Settings,
  ChevronRight,
  Plus,
  ArrowLeft,
  Check,
  ArrowUpRight,
  Sun,
  Moon,
  Bell,
  ShieldCheck,
  ListTodo,
  History,
  MessageSquare,
  Link2,
  Search,
  Save,
  Send,
  Mic,
  X,
  AlertCircle,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  PanelLeft,
  ExternalLink,
  SlidersHorizontal,
} from "lucide-react";
import "@fontsource/open-sans/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/open-sans/600.css";
import "./styles.css";
import { AuthGate, type AccessContext } from "./AuthGate";
import { profileRoleLabel } from "./ContextualHelper";
import { BrandLogo } from "./BrandLogo";
import { AdminDeliverables } from "./AdminDeliverables";
import { AdminActivity } from "./AdminActivity";
import {
  AdminOverview,
  AdminProjectProgress,
  AdminProjectToolsRail,
} from "./AdminOverview";
import { AdminExamplePreview } from "./AdminExamplePreview";
import "./admin-example-toggle.css";
import { AdminAssistantPanel } from "./AdminAssistantPanel";
import { AdminCreateAssistant } from "./AdminCreateAssistant";
import {
  ADMIN_SECTIONS,
  ADMIN_SECTION_LABELS,
  resolveAdminSection,
} from "./admin-navigation";
import "./admin-layout.css";
import { ProjectDashboard } from "./ProjectDashboard";
import { hasStakeholderContext } from "./dashboard-model";
import {
  AssistantDraftProvider,
  AssistantWorkspace,
  useAssistantDraftSession,
} from "./AssistantWorkspace";
import { QuickWireframe } from "./QuickWireframe";
import { createWireframeDraft, type WireframeDraft } from "./wireframe-model";
import {
  createBackendContract,
  canShowProjectAdminActions,
  isActiveVerifiedAdmin,
  isActiveVerifiedPerson,
  guardCurrentActorAction,
} from "./backend-contract";
import { WorkspaceAccounts, PersonDialog } from "./WorkspaceAccounts";
import {
  setTeamAssignment,
  isCommittedReceipt,
  type Account,
} from "./account-model";

type AnyRecord = Record<string, any>;
type ViewState = {
  demo: boolean;
  revision: number;
  currentActor: AnyRecord;
  actors: AnyRecord[];
  people: AnyRecord[];
  peopleHistory?: AnyRecord[];
  projects: (AnyRecord & { id: string; name: string })[];
  decisions: any[];
  capabilities: AnyRecord;
  accounts?: AnyRecord[];
  invitationConfiguration?: { enabled: boolean; reason?: string };
};
const icons = {
  overview: FolderKanban,
  assistant: MessageSquare,
  wireframe: LayoutDashboard,
  work: ListTodo,
  reviews: ShieldCheck,
  tasks: ListTodo,
  documents: FileText,
  team: Users,
  prd: FileText,
  questionnaire: MessageSquare,
  external: Link2,
  audit: History,
  settings: Settings,
};
const sections = {
  overview: "Overview",
  assistant: "AI Assistant",
  wireframe: "Quick wireframe",
  work: "Work setup",
  reviews: "Deliveries",
  tasks: "My tasks",
  documents: "Documents",
  team: "Team",
  prd: "Product requirements",
  questionnaire: "Questionnaire",
  external: "Linked tasks",
  audit: "Activity",
};

function Status({ value }: { value: string }) {
  const v = String(value || "Draft");
  return (
    <span
      className={
        "status " +
        (/approved|closed|published|completed/i.test(v)
          ? "success"
          : /return|change|fail|error/i.test(v)
            ? "warning"
            : /submit|review|pending|uncertain/i.test(v)
              ? "info"
              : "neutral")
      }
    >
      {v.replaceAll("_", " ")}
    </span>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <FolderKanban size={28} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
function App({
  actor,
  onSignOut,
  access,
}: {
  actor: string;
  onSignOut: () => void;
  access: AccessContext;
}) {
  const demo = access.mode === "demo";
  const contract = createReleasedBackendContract(demo ? "demo" : "accounts");
  const roles: readonly string[] = contract.projectGrantRoles;
  const { hasDrafts: hasAssistantDrafts } = useAssistantDraftSession();
  const [wireframeDrafts, setWireframeDrafts] = useState<
    Record<string, WireframeDraft>
  >({});
  const hasWireframeDrafts = Object.keys(wireframeDrafts).length > 0;
  useEffect(() => {
    if (!hasWireframeDrafts) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasWireframeDrafts]);
  const pendingRequests = useRef<
    Record<string, { requestId: string; expectedRevision: number }>
  >({});
  const [state, setReactState] = useState<ViewState | null>(null);
  const stateRef = useRef<ViewState | null>(null);
  const actionBusy = useRef(false);
  const setState = (next: ViewState | null) => {
    stateRef.current = next;
    setReactState(next);
  };
  const [exampleRequested, setExampleRequested] = useState(false);
  const [exampleHasDrafts, setExampleHasDrafts] = useState(false);
  const exampleActiveRef = useRef(false);
  const [route, setRoute] = useState(location.hash.slice(1) || "projects");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theme, setTheme] = useState(
    localStorage.getItem("astra-new-theme") || "light",
  );
  const [modal, setModal] = useState<{
    title: string;
    content: ReactNode;
  } | null>(null);
  const [sidebar, setSidebar] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  const epoch = useRef(0);
  const [query, setQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => {
    try {
      return demo
        ? JSON.parse(localStorage.getItem("astra-new-drafts") || "{}")
        : {};
    } catch {
      return {};
    }
  });
  const [submitTaskId, setSubmitTaskId] = useState("");
  const [externalTaskId, setExternalTaskId] = useState("");
  const [externalDeliveryId, setExternalDeliveryId] = useState("");
  const [taskSelection, setTaskSelection] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [conversation, setConversation] = useState<
    { role: string; text: string }[]
  >([]);
  const [suggestion, setSuggestion] = useState("");
  const [answers, setAnswers] = useState<(string | null)[]>(
    Array(10).fill(null),
  );
  const [questionIndex, setQuestionIndex] = useState(0);
  const [newProject, setNewProject] = useState({
    name: "",
    startDate: "",
    endDate: "",
    description: "",
    adminId: "",
    team: [] as AnyRecord[],
  });
  const [newTask, setNewTask] = useState({
    title: "",
    ownerId: "",
    documentTitles: "",
  });
  const [questionnairePerson, setQuestionnairePerson] = useState("");
  const [sourceSelections, setSourceSelections] = useState<
    Record<string, string[]>
  >({});
  const [person, setPerson] = useState("");
  const [role, setRole] = useState(roles[0]);
  const [externalContent, setExternalContent] = useState("");
  const [externalOutcome, setExternalOutcome] = useState("success");
  useEffect(() => {
    const fn = () => {
      if (exampleActiveRef.current) return;
      setRoute(location.hash.slice(1) || "projects");
      setSidebar(false);
      setError("");
      setSelected([]);
      setFeedback("");
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("astra-new-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (demo) localStorage.setItem("astra-new-drafts", JSON.stringify(drafts));
  }, [drafts, demo]);
  useEffect(() => {
    const n = ++epoch.current;
    setState(null);
    fetch("/api/state" + (demo ? "?actorId=" + actor : ""), {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          if (r.status === 401) access.refresh();
          throw new Error(d.error?.message || "Unable to open your workspace.");
        }
        return d;
      })
      .then((d) => {
        if (n === epoch.current) setState(d.state);
      })
      .catch(() =>
        setError(
          "Astra could not load. Check that the local service is running, then reload.",
        ),
      );
  }, [actor]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(() => {
    main.current?.focus();
  }, [route]);
  const parts = route.split("/");
  const project = state?.projects.find((p) => p.id === parts[1]);
  const section = parts[2] || "overview";
  const currentDoc = project?.documents.find(
    (d: AnyRecord) => d.id === parts[3],
  );
  const currentDelivery = project?.deliveries.find(
    (d: AnyRecord) => d.id === parts[3],
  );
  const isAdmin =
    !!state?.capabilities?.createProject &&
    (demo || isActiveVerifiedAdmin(state?.currentActor));
  // A display-only example is not the legacy role-selecting demo or a new session.
  const exampleActive = exampleRequested && isAdmin && !demo;
  exampleActiveRef.current = exampleActive;
  useEffect(() => {
    if (!isAdmin || demo) setExampleRequested(false);
  }, [isAdmin, demo]);
  const toggleExample = () => {
    if (exampleActive) {
      const leaveExample = () => {
        exampleActiveRef.current = false;
        setExampleRequested(false);
        setExampleHasDrafts(false);
        // Internal example navigation never touches the real route or its forms.
        if (location.hash.slice(1) !== route)
          history.replaceState(null, "", "#" + route);
      };
      if (exampleHasDrafts)
        confirm(
          "Discard local Demo drafts?",
          <p>
            Export your drafts first to keep them. Discarding affects only Demo
            drafts; your real projects and drafts stay unchanged.
          </p>,
          async () => leaveExample(),
          "Discard and turn off Demo",
        );
      else leaveExample();
      return;
    }
    if (
      demo ||
      !isActiveVerifiedAdmin(stateRef.current?.currentActor) ||
      !stateRef.current?.capabilities?.createProject ||
      busy ||
      actionBusy.current ||
      access.authBusy ||
      modal ||
      addPersonOpen ||
      Object.keys(pendingRequests.current).length > 0
    )
      return;
    exampleActiveRef.current = true;
    setExampleRequested(true);
  };
  const selectablePeople = (state?.people || []).filter(
    (person) => demo || isActiveVerifiedPerson(person),
  );
  const isStakeholder = state?.projects.some(
    (p) => p.questionnaire?.assignedTo === actor,
  );
  const navigate = (to: string) => {
    if (exampleActiveRef.current) return;
    location.hash = to;
  };
  const pname = (id: string) =>
    state?.people.find((p) => p.id === id)?.name ||
    state?.actors.find((p) => p.id === id)?.name ||
    state?.peopleHistory?.find((p) => p.id === id)?.name ||
    id;
  const action = async (
    type: string,
    payload: AnyRecord = {},
    success?: string,
  ) => {
    if (exampleActiveRef.current) {
      setError(
        "Demo example is read-only. Turn it off to change real project data.",
      );
      return null;
    }
    if (busy || access.authBusy || actionBusy.current) return null;
    const check = contract.guardAction(type, payload);
    if (!check.ok) {
      setError(check.message);
      return null;
    }
    if (!demo) {
      const actorCheck = guardCurrentActorAction(
        stateRef.current,
        type,
        payload,
      );
      if (!actorCheck.ok) {
        setError(actorCheck.message);
        return null;
      }
    }
    actionBusy.current = true;
    const requestEpoch = epoch.current;
    const fingerprint = JSON.stringify({ type, ...payload });
    const requestMeta = demo
      ? {}
      : (pendingRequests.current[fingerprint] ??= {
          requestId: crypto.randomUUID(),
          expectedRevision: stateRef.current?.revision ?? 0,
        });
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(!demo ? { "X-Astra-Csrf": access.csrfToken } : {}),
        },
        body: JSON.stringify({
          ...(demo ? { actorId: actor } : requestMeta),
          type,
          ...payload,
        }),
      });
      const data = await res.json();
      if (requestEpoch !== epoch.current) return null;
      if (data.state) setState(data.state);
      if (!res.ok || data.ok === false) {
        if (res.status === 401) {
          setState(null);
          access.refresh();
        }
        if (res.status < 500) delete pendingRequests.current[fingerprint];
        setError(
          data.error?.message ||
            "The change could not be confirmed. Your input is still here.",
        );
        return null;
      }
      delete pendingRequests.current[fingerprint];
      if (success) setNotice(success);
      return data.result ?? {};
    } catch {
      setError(
        "The remote result could not be confirmed. Your input is still here. Check the saved result before retrying; an identical retry keeps the same request identity.",
      );
      return null;
    } finally {
      actionBusy.current = false;
      setBusy(false);
    }
  };
  const ownTaskRequest = async (route: string, body?: AnyRecord) => {
    if (demo || exampleActiveRef.current || access.authBusy || !contract.features.ownTasks) throw Error("Task capability unavailable");
    if (route !== "state" && !/^receipts\/[0-9a-f-]{36}$/i.test(route) && route !== "action") throw Error("Invalid task route");
    if (body) {
      const payload = {projectId:body.projectId,titles:body.titles};
      if (route !== "action" || body.type !== "createOwnTasks" || Object.keys(body).some(k=>!["type","projectId","titles","requestId","expectedRevision"].includes(k)) || !contract.guardAction("createOwnTasks",payload).ok || !guardCurrentActorAction(stateRef.current,"createOwnTasks",payload).ok) throw Error("Task authority unavailable");
    }
    if(actionBusy.current) throw Error("Another operation is in progress");
    actionBusy.current=true;setBusy(true);const generation=epoch.current;
    try {
      const response=await fetch("/api/"+route,{method:body?"POST":"GET",credentials:"same-origin",cache:"no-store",headers:body?{"Content-Type":"application/json","X-Astra-Csrf":access.csrfToken}:{},...(body?{body:JSON.stringify(body)}:{})});
      const result=await response.json();
      if(generation!==epoch.current) throw Error("Session ended");
      if(response.status===401){setState(null);access.refresh();throw Error("Session ended");}
      return {...result,status:response.status};
    } finally { if(generation===epoch.current){actionBusy.current=false;setBusy(false);} }
  };
  const refreshWorkspace = async () => {
    if (busy || exampleActiveRef.current) return;
    setBusy(true);
    try {
      const res = await fetch(
        "/api/state" + (demo ? "?actorId=" + actor : ""),
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error?.message || "Workspace refresh failed.");
      setState(data.state);
      setNotice("Workspace refreshed. Your unsaved input is preserved.");
      setError("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The workspace could not be refreshed.",
      );
    } finally {
      setBusy(false);
    }
  };
  const checkPending = async () => {
    if (busy || demo || exampleActiveRef.current) return;
    setBusy(true);
    try {
      let unresolved = 0;
      for (const [fingerprint, meta] of Object.entries(
        pendingRequests.current,
      )) {
        const res = await fetch("/api/receipts/" + meta.requestId, {
            cache: "no-store",
          }),
          data = await res.json();
        if (!res.ok)
          throw new Error(
            data.error?.message || "The saved result could not be checked.",
          );
        if (data.state) setState(data.state);
        if (isCommittedReceipt(data.receipt))
          delete pendingRequests.current[fingerprint];
        else unresolved++;
      }
      setNotice(
        unresolved
          ? "No committed receipt is available yet. If retrying, keep the same action and content."
          : "Saved results checked. Confirmed operations will not be repeated.",
      );
      if (!unresolved) setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The saved result is still uncertain.",
      );
    } finally {
      setBusy(false);
    }
  };

  const openAddPerson = () => {
    if (!isAdmin || exampleActiveRef.current) return;
    if (
      !demo &&
      contract.features.accountRegistration &&
      state?.capabilities.manageAccounts
    ) {
      setAddPersonOpen(true);
      return;
    }
    setModal({
      title: "Add New Person",
      content: (
        <div>
          <p>Adding people requires the pending backend update.</p>
          <p>No account will be created and no invitation will be sent.</p>
          <p>
            Keep assignments empty for now. Existing members and projects are
            unchanged.
          </p>
        </div>
      ),
    });
  };
  const closeModal = () => setModal(null);
  const confirm = (
    title: string,
    body: ReactNode,
    onConfirm: () => Promise<any>,
    label = "Confirm",
  ) =>
    setModal({
      title,
      content: (
        <>
          <div>{body}</div>
          <div className="modal-actions">
            <button onClick={closeModal}>Cancel</button>
            <button
              className="primary"
              onClick={async () => {
                closeModal();
                await onConfirm();
              }}
            >
              {label}
            </button>
          </div>
        </>
      ),
    });
  const button = (
    label: string,
    onClick: () => void,
    primary = false,
    disabled = false,
  ) => (
    <button
      className={primary ? "primary" : ""}
      onClick={onClick}
      disabled={busy || disabled}
    >
      {label}
    </button>
  );
  const viewProject = (p: AnyRecord, sec = "overview") =>
    navigate("project/" + p.id + "/" + sec);
  const heading = (title: string, sub?: string, actions?: ReactNode) => (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
  const listDocuments = (p: AnyRecord) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Owner</th>
            <th>Version</th>
            <th>Status</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {p.documents.map((d: AnyRecord) => {
            const v =
              d.versions.find(
                (v: AnyRecord) => v.version === d.workingVersion,
              ) || d.versions.at(-1);
            return (
              <tr key={d.id}>
                <td>
                  <div className="row-title">
                    <FileText size={18} />
                    {d.title}
                  </div>
                </td>
                <td>{pname(d.ownerId)}</td>
                <td>v{v.version}</td>
                <td>
                  <Status value={v.status} />
                </td>
                <td>
                  <button
                    className="text-button"
                    onClick={() => navigate(`project/${p.id}/document/${d.id}`)}
                  >
                    Open <ChevronRight size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
  const deliveryList = (p: AnyRecord, all = false) => {
    const ds = p.deliveries.filter(
      (d: AnyRecord) =>
        all ||
        ["submitted", "under_review", "Submitted", "Under review"].includes(
          d.status,
        ),
    );
    return ds.length ? (
      <div className="stack">
        {ds.map((d: AnyRecord) => (
          <article className="delivery-row" key={d.id}>
            <div className="document-icon">
              <FileText size={24} />
            </div>
            <div className="grow">
              <div className="inline">
                <h3>
                  {d.title || "Specialist delivery"}{" "}
                  <span className="muted">v{d.version}</span>
                </h3>
                <Status value={d.status} />
              </div>
              <p>
                {pname(d.submittedBy)} · {d.documentVersions.length} documents ·{" "}
                {d.submittedAt
                  ? new Date(d.submittedAt).toLocaleDateString("en-US", {
                      timeZone: "UTC",
                    })
                  : ""}
              </p>
              {d.feedback && <p className="feedback">{d.feedback}</p>}
            </div>
            {button(
              (demo ? p.isAdmin : canShowProjectAdminActions(state, p)) &&
                ["submitted", "under_review"].includes(d.status)
                ? "Review delivery"
                : "View delivery",
              async () => {
                if (
                  (demo ? p.isAdmin : canShowProjectAdminActions(state, p)) &&
                  ["submitted", "under_review"].includes(d.status)
                ) {
                  const r = await action("openReview", {
                    projectId: p.id,
                    deliveryId: d.id,
                  });
                  if (r === null) return;
                }
                navigate(`project/${p.id}/review/${d.id}`);
              },
              isAdmin,
            )}
          </article>
        ))}
      </div>
    ) : (
      <Empty title="No deliveries waiting">
        New submitted work will appear here.
      </Empty>
    );
  };
  const sources = (p: AnyRecord) => p.prd?.sourceVersions || [];
  const logo = <BrandLogo />;
  let content: ReactNode = null;
  if (state) {
    if (route === "projects")
      content = (
        <ProjectDashboard
          projects={state.projects.map((p) => ({
            ...p,
            isAdmin: demo ? p.isAdmin : canShowProjectAdminActions(state, p),
          }))}
          actorId={actor}
          roles={state.currentActor.globalRoles || []}
          canCreate={isAdmin}
          people={Array.from(
            new Map(
              [...(state.peopleHistory || []), ...state.actors, ...state.people]
                .filter(
                  (person) => typeof person.id === "string" && person.id.trim(),
                )
                .map((person) => [
                  person.id,
                  {
                    id: String(person.id),
                    name:
                      typeof person.name === "string" ? person.name : undefined,
                    accountStatus:
                      typeof person.accountStatus === "string"
                        ? person.accountStatus
                        : undefined,
                  },
                ]),
            ).values(),
          )}
          onOpenLogs={isAdmin ? () => navigate("logs") : undefined}
          onCreate={() => navigate("create")}
          onOpen={(p, sec) => viewProject(p, sec)}
        />
      );
    else if (route === "logs")
      content = isAdmin ? (
        <div className="admin-workspace-logs">
          <button
            type="button"
            className="back-link"
            onClick={() => navigate("projects")}
          >
            <ArrowLeft size={16} />
            Your Projects
          </button>
          {heading(
            "Project logs",
            "Read-only activity from projects you can access.",
          )}
          {state.projects.length ? (
            state.projects.map((p) => (
              <section key={p.id}>
                <h2>{p.name}</h2>
                <AdminActivity p={p} personName={pname} />
              </section>
            ))
          ) : (
            <Empty title="No project logs yet">
              Create your first project to begin.
            </Empty>
          )}
        </div>
      ) : (
        <Empty title="Admin access required">
          Choose an assigned project to continue.
        </Empty>
      );
    else if (route === "create" && !isAdmin)
      content = (
        <Empty title="Only Admin can create projects">
          Choose an assigned project to continue.
        </Empty>
      );
    else if (route === "create")
      content = (
        <>
          {heading(
            "Create project",
            "Add the basics, then explicitly select your administrator and team.",
          )}
          <div className="two-column admin-create-layout">
            <form
              id="admin-create-project-form"
              className="admin-create-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const r = await action(
                  "createProject",
                  { project: newProject },
                  "Project created with explicit assignments.",
                );
                if (r) {
                  navigate("projects");
                  setNewProject({
                    name: "",
                    startDate: "",
                    endDate: "",
                    description: "",
                    adminId: "",
                    team: [],
                  });
                }
              }}
            >
              <section className="panel padded">
                <h2>Project details</h2>
                <label>
                  Project name
                  <input
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                    placeholder="e.g. Customer onboarding"
                  />
                </label>
                <div className="two-fields">
                  <label>
                    Start date
                    <input
                      type="date"
                      value={newProject.startDate}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          startDate: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Tentative end date
                    <input
                      type="date"
                      value={newProject.endDate}
                      onChange={(e) =>
                        setNewProject({
                          ...newProject,
                          endDate: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Description / scope
                  <textarea
                    rows={5}
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        description: e.target.value,
                      })
                    }
                    placeholder="What are we working toward?"
                  />
                </label>
                <label>
                  Project administrator
                  <select
                    value={newProject.adminId}
                    onChange={(e) =>
                      setNewProject({ ...newProject, adminId: e.target.value })
                    }
                  >
                    <option value="">Select explicitly</option>
                    {state.people
                      .filter((p) => demo || isActiveVerifiedAdmin(p))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                {!demo &&
                  contract.features.accountManagement &&
                  state.capabilities.manageAccounts && (
                    <button
                      type="button"
                      onClick={() => setAddPersonOpen(true)}
                    >
                      <Plus size={16} />
                      Add New Person
                    </button>
                  )}
                <p className="helper">
                  Creating a project does not assign specialist roles to its
                  creator.
                </p>
              </section>
            </form>
            <aside
              className="admin-create-rail"
              aria-label="Team and project setup assistant"
            >
              <section
                className="panel padded admin-create-team"
                aria-label="Team assignments"
              >
                <div className="inline spread">
                  <h2>Team assignments</h2>
                  {isAdmin && (
                    <button type="button" onClick={openAddPerson}>
                      <Plus size={16} />
                      Add New Person
                    </button>
                  )}
                </div>
                <p className="muted">
                  Assignments can stay empty and be completed later. New roles
                  are shown for preview only; assignment requires the pending
                  backend update. Existing assignments are preserved.
                </p>
                {[
                  ...new Set([
                    "Stakeholder",
                    "PM",
                    ...roles,
                    "UX Designer",
                    "Full Stack Web Developer",
                    "DevOps",
                  ]),
                ].map((r) => {
                  const assigned = newProject.team.filter((t) =>
                    t.roles.includes(r),
                  );
                  const eligible = selectablePeople.filter(
                    (person) =>
                      demo ||
                      !["Admin", "PM"].includes(r) ||
                      ((person.accountStatus || person.status) === "active" &&
                        person.globalRoles?.includes("Admin")),
                  );
                  return (
                    <fieldset
                      key={r}
                      className="team-role-picker"
                      disabled={!roles.includes(r)}
                    >
                      <legend>{r}</legend>
                      {r === "PM" ? (
                        <select
                          aria-label="PM"
                          value={assigned[0]?.personId || ""}
                          onChange={(event) =>
                            setNewProject((current) => ({
                              ...current,
                              team: setTeamAssignment(
                                current.team
                                  .map((entry) => ({
                                    ...entry,
                                    personId: String(entry.personId),
                                    roles: entry.roles.filter(
                                      (value: string) => value !== "PM",
                                    ),
                                  }))
                                  .filter((entry) => entry.roles.length),
                                "PM",
                                event.target.value,
                                Boolean(event.target.value),
                              ),
                            }))
                          }
                        >
                          <option value="">Unassigned</option>
                          {eligible.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <details>
                          <summary>
                            {assigned.length
                              ? assigned
                                  .map((t) => pname(t.personId))
                                  .join(", ")
                              : "Unassigned"}
                          </summary>
                          <div className="team-role-options">
                            {eligible.map((person) => (
                              <label key={person.id} className="inline">
                                <input
                                  type="checkbox"
                                  form="admin-create-project-form"
                                  checked={assigned.some(
                                    (t) => t.personId === person.id,
                                  )}
                                  onChange={(event) =>
                                    setNewProject((current) => ({
                                      ...current,
                                      team: setTeamAssignment(
                                        current.team as {
                                          personId: string;
                                          roles: string[];
                                        }[],
                                        r,
                                        person.id,
                                        event.target.checked,
                                      ),
                                    }))
                                  }
                                />
                                <span>
                                  {person.name}
                                  {person.accountStatus === "pending"
                                    ? " · Pending verification"
                                    : ""}
                                </span>
                              </label>
                            ))}
                            {!demo &&
                              contract.features.accountManagement &&
                              state.capabilities.manageAccounts && (
                                <button
                                  type="button"
                                  onClick={() => setAddPersonOpen(true)}
                                >
                                  <Plus size={16} />
                                  Add New Person
                                </button>
                              )}
                            {!eligible.length && (
                              <p className="helper">No eligible members yet.</p>
                            )}
                          </div>
                        </details>
                      )}
                    </fieldset>
                  );
                })}
              </section>
              <AdminCreateAssistant actorId={actor} />
            </aside>
          </div>
          <div className="inline-note">
            <AlertCircle size={18} />
            <span>
              Team assignments can remain empty. Adding people is currently
              unavailable; an invitation is sent only after a separate
              confirmation and when email delivery is configured.
            </span>
          </div>
          <div className="form-footer">
            <button type="button" onClick={() => navigate("projects")}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              type="submit"
              form="admin-create-project-form"
            >
              <Plus size={18} />
              Create project
            </button>
          </div>
        </>
      );
    else if (route === "settings")
      content = (
        <>
          {heading("Settings", "Your preferences and connection readiness.")}
          <div className="settings-layout">
            <section className="panel padded">
              <h2>Profile & appearance</h2>
              <p>
                <strong>{state.currentActor.name}</strong>
                <br />
                <span className="muted">
                  {demo
                    ? "Synthetic evaluation account"
                    : state.currentActor.email}
                </span>
              </p>
              <label>
                Color mode
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </label>
              <p className="helper">Appearance is saved on this device.</p>
            </section>
            <section className="panel padded">
              <h2>Connectors</h2>
              <p className="muted">
                Company permission, provider consent and project authority are
                separate.
              </p>
              {[
                [
                  "OpenAI",
                  "Contextual text & conversational voice",
                  "Not configured",
                ],
                [
                  "ClickUp",
                  "One principal task manager per project",
                  "Simulation only",
                ],
                [
                  "Microsoft Teams",
                  "Messages, notifications & calendar",
                  "Action mapping pending",
                ],
                ["Jira", "Future task manager", "Planned"],
                ["Canva & Clarity", "Product direction", "Planned"],
                ["Corporate SSO", "Organization sign-in", "Not configured"],
              ].map(([name, desc, status]) => (
                <div className="connector" key={name}>
                  <div className="connector-letter">{name[0]}</div>
                  <div className="grow">
                    <strong>{name}</strong>
                    <p>{desc}</p>
                  </div>
                  <Status value={status} />
                </div>
              ))}
              <p className="helper">
                {demo
                  ? "No credentials are requested or stored by this evaluation."
                  : "Account sign-in uses Supabase Auth. Passwords and session tokens are not written to application files."}{" "}
                These connector cards do not represent live integrations.
              </p>
            </section>
          </div>
          {demo && (
            <section className="panel padded">
              <h2>Evaluation controls</h2>
              <p className="muted">
                Use fictional content only. Test recoveries and compare the same
                scenarios in Lovable.
              </p>
              <div className="actions">
                <button
                  onClick={() =>
                    action(
                      "injectFailure",
                      { enabled: true },
                      "The next save will fail intentionally. Your input will be preserved.",
                    )
                  }
                >
                  <AlertCircle size={17} />
                  Fail next save
                </button>
                <button
                  onClick={() =>
                    confirm(
                      "Reset synthetic evaluation?",
                      <p>
                        This replaces the new app’s demo data and clears local
                        working text. The previous prototype is not touched.
                      </p>,
                      async () => {
                        const r = await action("resetDemo", {}, "Demo reset.");
                        if (r) {
                          setDrafts({});
                          setSuggestions({});
                          setSelected([]);
                          setTaskSelection([]);
                          setQuestionIndex(0);
                          setMessage("");
                          setConversation([]);
                          setSuggestion("");
                          setExternalContent("");
                          setFeedback("");
                          navigate("projects");
                        }
                      },
                    )
                  }
                >
                  <RefreshCw size={17} />
                  Reset demo
                </button>
              </div>
            </section>
          )}
          {!demo &&
            contract.features.accountManagement &&
            state.capabilities.manageAccounts && (
              <WorkspaceAccounts
                accounts={(state.accounts || []) as Account[]}
                actorId={actor}
                action={action}
                errorMessage={error}
                busy={busy}
                invitationEnabled={
                  state.capabilities.inviteAccounts === true ||
                  state.invitationConfiguration?.enabled === true
                }
                invitationReason={
                  state.capabilities.inviteUnavailableReason ||
                  state.invitationConfiguration?.reason
                }
              />
            )}
          {!demo && !contract.features.accountManagement && isAdmin && (
            <section className="panel padded">
              <h2>Workspace accounts</h2>
              <p>
                Account editing, new role assignments and invitations await a
                compatible backend update. Existing accounts and project
                assignments are preserved.
              </p>
              <ul>
                {(state.accounts || []).map((account) => (
                  <li key={account.id}>
                    <strong>{account.name}</strong> ·{" "}
                    {(account.globalRoles || []).join(", ")} ·{" "}
                    {account.status || "Status not recorded"}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {demo && (
            <section className="panel padded">
              <h2>Requirements still to decide</h2>
              <div className="decisions">
                {state.decisions.map((d, i) => (
                  <div key={i}>
                    <strong>
                      {typeof d === "string" ? d : d.title || d.id || d.topic}
                    </strong>
                    {typeof d !== "string" && (
                      <p>
                        {d.description || d.question || d.detail || d.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      );
    else if (project) {
      const p = project;
      const chosenSources: string[] = sourceSelections[p.id] ?? p.prd.requiredSourceIds;
      const isAdmin = demo ? !!p.isAdmin : canShowProjectAdminActions(state, p);
      const isStakeholder = p.questionnaire?.assignedTo === actor;
      const canWireframe = hasStakeholderContext(p, actor);
      const specialistTasks = specialistAssignedTasks(p, actor);
      const isSpecialist = specialistTasks.length > 0;
      const section = isAdmin
        ? resolveAdminSection(parts[2] || "overview")
        : parts[2] || "overview";
      const tabs = isAdmin
        ? [...ADMIN_SECTIONS]
        : Object.keys(sections).filter((s) =>
            s === "assistant"
              ? true
              : s === "wireframe"
                ? canWireframe
                : isStakeholder
                  ? [
                      "overview",
                      "questionnaire",
                      "documents",
                      "audit",
                    ].includes(s)
                  : !isSpecialist
                    ? !["tasks", "questionnaire", "work"].includes(s)
                    : !["team", "prd", "questionnaire", "work"].includes(s),
          );
      const openAdminDelivery = async (delivery: AnyRecord) => {
        if (["submitted", "under_review"].includes(delivery.status)) {
          const result = await action("openReview", {
            projectId: p.id,
            deliveryId: delivery.id,
          });
          if (result === null) return;
        }
        navigate(`project/${p.id}/review/${delivery.id}`);
      };
      const projectHeader = (
        <>
          <button className="back-link" onClick={() => navigate("projects")}>
            <ArrowLeft size={16} />
            All projects
          </button>
          {isAdmin &&
          (ADMIN_SECTIONS.some((key) => key === section) ||
            section === "review") ? (
            <div className="admin-overview-page-heading">
              {heading(p.name, p.description)}
              <AdminProjectProgress p={p} />
            </div>
          ) : (
            heading(p.name, p.description)
          )}
          <nav className="tabs" aria-label="Project navigation">
            {isAdmin && <ProjectTabIndicator />}
            {tabs.map((s) => {
              const Icon = icons[s as keyof typeof icons];
              return (
                <button
                  key={s}
                  aria-current={section === s ? "page" : undefined}
                  className={section === s ? "active" : ""}
                  onClick={() => viewProject(p, s)}
                >
                  <Icon size={16} />
                  {isAdmin
                    ? ADMIN_SECTION_LABELS[s]
                    : sections[s as keyof typeof sections]}
                  {s === "reviews" && p.summary?.needsReview > 0 && (
                    <span className="tab-count">{p.summary.needsReview}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </>
      );
      let body: ReactNode;
      if (section === "overview" && isAdmin)
        body = (
          <AdminOverview
            p={p}
            actorId={actor}
            personName={pname}
            onOpenDelivery={openAdminDelivery}
            busy={busy}
            onViewAll={() => viewProject(p, "reviews")}
          />
        );
      else if (section === "settings" && isAdmin)
        body = (
          <AdminProjectSettings key={p.id} project={p} people={state.people} />
        );
      else if (section === "tasks" && isAdmin)
        body = contract.features.ownTasks && !demo ? <AdminOwnTasksPanel key={actor+":"+p.id} enabled={contract.features.ownTasks} project={p} actorId={actor} workspaceId="xupximxdfucawteiuhcr" personName={pname} contract={contract} getState={()=>stateRef.current} request={ownTaskRequest} onState={setState}/> : <AdminMyTasks p={p} actorId={actor} personName={pname} />;
      else if (section === "overview" && isStakeholder)
        body = <StakeholderOverview project={p} actorId={actor}
          onOpenQuestionnaire={() => viewProject(p, "questionnaire")}
          onOpenDocuments={() => viewProject(p, "documents")}
          onOpenActivity={() => viewProject(p, "audit")} />;
      else if (section === "overview")
        body = (
          <div className="overview-grid">
            <div className="stack">
              <section className="panel">
                <div className="panel-heading">
                  <h2>{isAdmin ? "Needs your review" : "Recent deliveries"}</h2>
                  <button
                    className="text-button"
                    onClick={() => viewProject(p, "reviews")}
                  >
                    View all <ChevronRight size={16} />
                  </button>
                </div>
                {deliveryList(p, !isAdmin)}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Project documents</h2>
                  <button
                    className="text-button"
                    onClick={() => viewProject(p, "documents")}
                  >
                    View documents <ChevronRight size={16} />
                  </button>
                </div>
                {listDocuments(p)}
              </section>
            </div>
            <aside className="stack">
              <section className="panel padded">
                <div className="inline spread">
                  <h2>PRD readiness</h2>
                  <FileText size={20} />
                </div>
                <div className="readiness">
                  <strong>{p.prd?.readiness?.approved ?? 0}</strong>
                  <span>
                    of {p.prd?.readiness?.total ?? 0}
                    <br />
                    required sources approved
                  </span>
                </div>
                <progress
                  aria-label="Required source readiness"
                  value={p.prd?.readiness?.approved ?? 0}
                  max={p.prd?.readiness?.total || 1}
                />
                <p className="helper">
                  Readiness tracks applicable sources, not overall project
                  progress.
                </p>
                {isAdmin && (
                  <button
                    className="full"
                    onClick={() => viewProject(p, "prd")}
                  >
                    Prepare PRD <ChevronRight size={16} />
                  </button>
                )}
              </section>
              <section className="panel padded">
                <p className="eyebrow">YOUR PROJECT CONTEXT</p>
                <h2>AI Assistant</h2>
                <p>
                  Bring notes and references together for your role. AI
                  responses and voice are not connected yet.
                </p>
                <button
                  className="full"
                  onClick={() => viewProject(p, "assistant")}
                >
                  Open assistant <ChevronRight size={16} />
                </button>
              </section>
              <div className="small-note">
                <LockKeyhole size={17} />
                <span>
                  Approval applies to an exact version. External publishing is
                  always a separate step.
                </span>
              </div>
            </aside>
          </div>
        );
      else if (section === "assistant")
        body = (
          <AssistantWorkspace
            context={{
              actorId: actor,
              projectId: p.id,
              projectName: p.name,
              roleLabel: profileRoleLabel(state.currentActor),
              scopeId: "project",
              scopeLabel: "Project context",
            }}
            tasks={[
              ...(isAdmin
                ? [
                    {
                      id: "reviews",
                      label: "Review deliveries",
                      onOpen: () => viewProject(p, "reviews"),
                    },
                  ]
                : []),
              ...(isStakeholder
                ? [
                    {
                      id: "questionnaire",
                      label: "Open questionnaire",
                      onOpen: () => viewProject(p, "questionnaire"),
                    },
                  ]
                : []),
              ...(canWireframe
                ? [
                    {
                      id: "wireframe",
                      label: "Quick wireframe",
                      onOpen: () => viewProject(p, "wireframe"),
                    },
                  ]
                : []),
              ...p.tasks
                .filter((task: AnyRecord) => task.ownerId === actor)
                .map((task: AnyRecord) => ({
                  id: task.id,
                  label: task.title,
                  onOpen: () => viewProject(p, "tasks"),
                })),
            ]}
          />
        );
      else if (section === "wireframe" && canWireframe) {
        const key = JSON.stringify([actor, p.id]);
        body = (
          <QuickWireframe
            key={key}
            projectId={p.id}
            projectName={p.name}
            draft={wireframeDrafts[key] || createWireframeDraft(p.id)}
            onDraftChange={(draft) =>
              setWireframeDrafts((all) => ({ ...all, [key]: draft }))
            }
          />
        );
      } else if (section === "reviews")
        body = isAdmin ? (
          <AdminDeliverables
            p={p}
            personName={pname}
            onOpenDelivery={openAdminDelivery}
            busy={busy}
          />
        ) : (
          <section className="panel">
            <div className="panel-heading">
              <h2>Deliveries &amp; review</h2>
              <span className="muted">
                Submitted and under review stay pending
              </span>
            </div>
            {deliveryList(p, true)}
          </section>
        );
      else if (section === "documents")
        body = (
          <section className="panel">
            <div className="panel-heading">
              <h2>Documents</h2>
              <span className="muted">Exact versions, preserved history</span>
            </div>
            {listDocuments(p)}
          </section>
        );
      else if (section === "team")
        body = isAdmin ? (
          <AdminTeamPreview
            key={p.id}
            project={p}
            people={state.people.map((person) => ({
              id: String(person.id),
              name: person.name,
              email: person.email,
            }))}
          />
        ) : (
          <section className="panel padded">
            <div className="inline spread">
              <h2>People & roles</h2>
              {isAdmin && (
                <button type="button" disabled={busy} onClick={openAddPerson}>
                  <Plus size={16} />
                  Add New Person
                </button>
              )}
            </div>
            <p className="muted">
              Assignments are explicit. Changes never silently transfer work.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Assigned roles</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.team.map((t: AnyRecord) => (
                    <tr key={t.personId}>
                      <td>
                        <strong>{pname(t.personId)}</strong>
                      </td>
                      <td>{t.roles.join(", ")}</td>
                      <td>
                        <Status
                          value={
                            state.people.find(
                              (person) => person.id === t.personId,
                            )?.accountStatus === "pending"
                              ? "Pending verification"
                              : "Assigned"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <form
                className="assignment-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  await action(
                    "assignRole",
                    { projectId: p.id, personId: person, role },
                    "Role assigned without transferring existing work.",
                  );
                }}
              >
                <label>
                  Person
                  <select
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                  >
                    <option value="">Choose person</option>
                    {selectablePeople.map((x) => (
                      <option value={x.id} key={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Role
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    {roles.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                    {!demo && (
                      <optgroup label="Pending backend support">
                        {["UX Designer", "Full Stack Development", "PM"]
                          .filter((name) => !roles.includes(name))
                          .map((name) => (
                            <option key={name} value={name} disabled>
                              {name} · Unavailable
                            </option>
                          ))}
                        <option value="Development" disabled>
                          Development · Legacy task label
                        </option>
                        <option value="DevOps" disabled>
                          DevOps · Legacy task label
                        </option>
                      </optgroup>
                    )}
                  </select>
                </label>
                <button disabled={busy || !person} className="primary">
                  Assign role
                </button>
              </form>
            )}
            {isAdmin && !demo && (
              <p className="team-role-availability">
                More roles require a backend update. Existing assignments are
                preserved.
              </p>
            )}
            <div className="inline-note">
              <AlertCircle size={18} />
              <span>
                Role removal and reassignment are unavailable until the
                unfinished-work handover policy is agreed.
              </span>
            </div>
          </section>
        );
      else if (section === "work" && isAdmin) {
        const owners = p.team.filter((m: AnyRecord) =>
          contract.isTaskOwnerEligible(
            state.people.find((person) => person.id === m.personId),
            m,
          ),
        );
        const stakeholders = p.team.filter(
          (m: AnyRecord) =>
            m.roles.includes("Stakeholder") &&
            (demo ||
              isActiveVerifiedPerson(
                state.people.find((person) => person.id === m.personId),
              )),
        );
        const chosenSources = sourceSelections[p.id] ?? p.prd.requiredSourceIds;
        body = (
          <>
            <div className="section-heading">
              <div>
                <h2>Set up project work</h2>
                <p className="muted">
                  Assign work explicitly. A project role does not silently
                  create or complete tasks.
                </p>
              </div>
            </div>
            <div className="review-grid">
              <section className="panel padded">
                <h2>Create a task</h2>
                <p className="helper">
                  Add blank working documents for an assigned specialist.
                  Nothing is submitted or published.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const documentTitles = newTask.documentTitles
                      .split("\n")
                      .map((t) => t.trim())
                      .filter(Boolean);
                    if (
                      await action(
                        "createTask",
                        {
                          projectId: p.id,
                          task: {
                            title: newTask.title,
                            ownerId: newTask.ownerId,
                            documentTitles,
                          },
                        },
                        "Task and blank working documents created.",
                      )
                    )
                      setNewTask({
                        title: "",
                        ownerId: "",
                        documentTitles: "",
                      });
                  }}
                >
                  <label>
                    Task title
                    <input
                      required
                      maxLength={200}
                      value={newTask.title}
                      onChange={(e) =>
                        setNewTask((t) => ({ ...t, title: e.target.value }))
                      }
                    />
                  </label>
                  <label>
                    Assigned specialist
                    <select
                      required
                      value={newTask.ownerId}
                      onChange={(e) =>
                        setNewTask((t) => ({ ...t, ownerId: e.target.value }))
                      }
                    >
                      <option value="">Choose a project specialist</option>
                      {owners.map((m: AnyRecord) => (
                        <option key={m.personId} value={m.personId}>
                          {pname(m.personId)} ·{" "}
                          {m.roles
                            .filter((r: string) => contract.isTaskRole(r))
                            .join(", ")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!owners.length && (
                    <p className="helper">
                      Assign a specialist role in Team first. Admin alone does
                      not imply a specialist role.
                    </p>
                  )}
                  <label>
                    Working document titles
                    <textarea
                      required
                      rows={4}
                      value={newTask.documentTitles}
                      onChange={(e) =>
                        setNewTask((t) => ({
                          ...t,
                          documentTitles: e.target.value,
                        }))
                      }
                      placeholder={"Research Findings\nExperience Goals"}
                    />
                  </label>
                  <p className="helper">
                    One title per line, up to ten documents. Initial content is
                    blank.
                  </p>
                  <button className="primary" disabled={busy || !owners.length}>
                    Create assigned task
                  </button>
                </form>
              </section>
              <section className="panel padded">
                <h2>Stakeholder questionnaire</h2>
                {p.questionnaire ? (
                  <>
                    <p>
                      Assigned to{" "}
                      <strong>{pname(p.questionnaire.assignedTo)}</strong>.
                    </p>
                    <Status value={p.questionnaire.status} />
                    <p className="helper">
                      Reassignment is unavailable until the handover policy is
                      agreed. Existing answers stay with their owner.
                    </p>
                  </>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      await action(
                        "assignQuestionnaire",
                        { projectId: p.id, personId: questionnairePerson },
                        "Ten optional questions assigned to the selected Stakeholder.",
                      );
                    }}
                  >
                    <p>
                      Assign the existing ten-question intake to a Stakeholder
                      on this project.
                    </p>
                    <label>
                      Assigned Stakeholder
                      <select
                        required
                        value={questionnairePerson}
                        onChange={(e) => setQuestionnairePerson(e.target.value)}
                      >
                        <option value="">Choose a project Stakeholder</option>
                        {stakeholders.map((m: AnyRecord) => (
                          <option key={m.personId} value={m.personId}>
                            {pname(m.personId)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="helper">
                      All responses start blank and remain optional. Add a
                      Stakeholder in Team if none is listed.
                    </p>
                    <button disabled={busy || !stakeholders.length}>
                      Assign questionnaire
                    </button>
                  </form>
                )}
              </section>
            </div>
            <section className="panel padded">
              <h2>Required PRD sources</h2>
              <p>
                Select the documents this project requires before PRD closure.
                This is an explicit applicability decision, not an automatic
                eight-document rule.
              </p>
              {p.documents.length ? (
                p.documents.map((d: AnyRecord) => (
                  <label className="check-row" key={d.id}>
                    <input
                      type="checkbox"
                      checked={chosenSources.includes(d.id)}
                      onChange={(e) =>
                        setSourceSelections((all) => ({
                          ...all,
                          [p.id]: e.target.checked
                            ? [...chosenSources, d.id]
                            : chosenSources.filter((id: string) => id !== d.id),
                        }))
                      }
                    />
                    <div>
                      <strong>{d.title}</strong>
                      <span>{pname(d.ownerId)}</span>
                    </div>
                  </label>
                ))
              ) : (
                <p className="helper">
                  Create task documents before selecting sources.
                </p>
              )}
              <div className="form-footer">
                <p className="helper">
                  Changing sources invalidates the prepared PRD review. Prepare
                  and review a fresh draft before closure.
                </p>
                <button
                  disabled={busy || !p.documents.length}
                  onClick={() =>
                    confirm(
                      "Update required PRD sources?",
                      <p>
                        {chosenSources.length} documents will be required. Any
                        prepared PRD needs a fresh review.
                      </p>,
                      () =>
                        action(
                          "setRequiredSources",
                          { projectId: p.id, documentIds: chosenSources },
                          "Required sources updated. Prepare a fresh PRD draft.",
                        ),
                      "Update required sources",
                    )
                  }
                >
                  Save source selection
                </button>
              </div>
            </section>
            <section className="panel padded">
              <h2>Assigned tasks</h2>
              {p.tasks.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Task</th>
                        <th>Owner</th>
                        <th>Documents</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.tasks.map((t: AnyRecord) => (
                        <tr key={t.id}>
                          <td>{t.title}</td>
                          <td>{pname(t.ownerId)}</td>
                          <td>{t.documentIds.length}</td>
                          <td>
                            <Status value={t.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No tasks have been assigned yet.</p>
              )}
            </section>
          </>
        );
      } else if (section === "select" && !isSpecialist) {
        body = <Empty title="No specialist work assigned">This action is available only for your assigned specialist tasks. Stakeholder questionnaires use their own workflow.</Empty>;
      } else if (
        section === "select" ||
        (section === "tasks" &&
          isSpecialist &&
          !p.workSelections?.[actor]?.firstEntryComplete)
      )
        body = (
          <section className="panel padded narrow">
            <h2>Select your work</h2>
            <p className="muted">
              Activate applicable tasks for this project. Selection does not
              mark them complete.
            </p>
            {specialistTasks.map((t: AnyRecord) => (
                <label className="check-row" key={t.id}>
                  <input
                    type="checkbox"
                    checked={taskSelection.includes(t.id)}
                    onChange={(e) =>
                      setTaskSelection((ids) =>
                        e.target.checked
                          ? [...ids, t.id]
                          : ids.filter((id) => id !== t.id),
                      )
                    }
                  />
                  <div>
                    <strong>{t.title}</strong>
                    <span>Assigned to {pname(t.ownerId)}</span>
                  </div>
                </label>
              ))}
            <div className="form-footer">
              <button onClick={() => viewProject(p, "overview")}>
                Back to overview
              </button>
              <button
                className="primary"
                disabled={busy || !taskSelection.length}
                onClick={async () => {
                  const selection = specialistSelection(stateRef.current, p.id, actor, taskSelection);
                  if (!selection.ok) { setError(selection.message); return; }
                  if (
                    await action(
                      "selectTasks",
                      selection.payload,
                      "Selected work activated. Nothing was marked complete.",
                    )
                  )
                    viewProject(p, "tasks");
                }}
              >
                Activate selected work
              </button>
            </div>
          </section>
        );
      else if (section === "tasks")
        body = (
          <>
            <div className="section-heading">
              <div>
                <h2>My tasks</h2>
                <p className="muted">
                  Task completion is separate from document submission.
                </p>
              </div>
              <div className="actions">
                <button
                  onClick={() => {
                    setTaskSelection(
                      p.workSelections?.[actor]?.selectedTaskIds || [],
                    );
                    viewProject(p, "select");
                  }}
                >
                  Select work
                </button>
                {button(
                  "Review submission",
                  () => {
                    setSelected(
                      p.documents
                        .filter(
                          (d: AnyRecord) =>
                            d.ownerId === actor &&
                            d.versions.some(
                              (v: AnyRecord) =>
                                v.version === d.workingVersion &&
                                v.status === "draft",
                            ),
                        )
                        .map((d: AnyRecord) => d.id),
                    );
                    navigate(`project/${p.id}/submit`);
                  },
                  true,
                )}
              </div>
            </div>
            <div className="stack">
              {p.tasks
                .filter(
                  (t: AnyRecord) =>
                    t.ownerId === actor &&
                    (p.workSelections?.[actor]?.selectedTaskIds || []).includes(
                      t.id,
                    ),
                )
                .map((t: AnyRecord) => (
                  <article className="task-row" key={t.id}>
                    <div className="task-check">
                      <ListTodo size={22} />
                    </div>
                    <div className="grow">
                      <div className="inline">
                        <h3>{t.title}</h3>
                        <Status
                          value={
                            t.status || (t.completed ? "Completed" : "Active")
                          }
                        />
                      </div>
                      <p>
                        {t.discipline || t.role || "Specialist work"} ·{" "}
                        {pname(t.ownerId || t.assigneeId)}
                      </p>
                    </div>
                    {button("Open task", () => {
                      const d = p.documents.find(
                        (d: AnyRecord) => d.taskId === t.id,
                      );
                      if (d) navigate(`project/${p.id}/document/${d.id}`);
                    })}
                  </article>
                ))}
            </div>
          </>
        );
      else if (section === "document" && currentDoc) {
        const d = currentDoc;
        const v =
          d.versions.find((v: AnyRecord) => v.version === d.workingVersion) ||
          d.versions.at(-1);
        const draftKey = actor + ":" + p.id + ":" + d.id + ":" + v.version;
        const editPermission = p.documentEditPermissions?.[d.id];
        const documentOwner = state.people?.find((person: AnyRecord) => person.id === d.ownerId);
        const currentEditPermission = !!documentOwner && editPermission?.allowed === true && editPermission.userId === d.ownerId && Number.isSafeInteger(documentOwner?.accessVersion) && documentOwner.accessVersion > 0 && editPermission.ownerAccessVersion === documentOwner.accessVersion;
        const editable = d.ownerId === actor && d.canEdit !== false && v.status === "draft";
        const value = editable ? (drafts[draftKey] ?? v.content) : v.content;
        const conversation = (p.conversations?.[d.taskId] || []).map(
          (m: AnyRecord) => ({ role: m.role, text: m.content }),
        );
        const suggestion =
          suggestions[actor + ":" + p.id + ":" + d.taskId] || "";
        const setSuggestion = (value: string) =>
          setSuggestions((s) => ({
            ...s,
            [actor + ":" + p.id + ":" + d.taskId]: value,
          }));
        const messageKey = "message:" + actor + ":" + p.id + ":" + d.taskId;
        const message = drafts[messageKey] || "";
        const setMessage = (value: string) =>
          setDrafts((ds) => ({ ...ds, [messageKey]: value }));
        const updateDraft = (text: string) =>
          setDrafts((x) => ({ ...x, [draftKey]: text }));
        const save = async () => {
          const checked = specialistDocumentAction(stateRef.current, p.id, actor, [d.id], { [d.id]: v.version });
          if (!checked.ok) { setError(checked.message); return null; }
          const r = await action(
            "saveDraft",
            { projectId: p.id, documentId: d.id, content: value },
            `Draft v${v.version} saved. Nothing was submitted.`,
          );
          if (r !== null)
            setDrafts((x) => {
              const next = { ...x };
              if (next[draftKey] === value) delete next[draftKey];
              return next;
            });
          return r;
        };
        body = (
          <>
            <DocumentEditPermission key={actor + ":" + p.id + ":" + d.id + ":" + d.ownerId + ":" + documentOwner?.accessVersion} enabled={contract.features.documentEditPermissions} isAdmin={isAdmin} projectId={p.id} documentId={d.id} ownerName={pname(d.ownerId)} granted={currentEditPermission} expired={editPermission?.allowed === true && !currentEditPermission} busy={busy} action={action} />
            <div className="section-heading">
              <div>
                <div className="inline">
                  <h2>{d.title}</h2>
                  <Status value={v.status} />
                  <span className="muted">v{v.version}</span>
                </div>
                <p className="muted">
                  Human owner: {pname(d.ownerId)} ·{" "}
                  {editable ? "Working document" : "Read-only version"}
                </p>
              </div>
              {editable && (
                <div className="actions">
                  <button onClick={save} disabled={busy}>
                    <Save size={16} />
                    Save draft
                  </button>
                  <button
                    className="primary"
                    onClick={async () => {
                      if ((await save()) !== null)
                        navigate(`project/${p.id}/submit/${d.taskId}`);
                    }}
                    disabled={busy}
                  >
                    Save & next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="editor-grid">
              <section className="panel padded document-editor">
                <div className="inline spread">
                  <h3>{editable ? "Working document" : "Saved snapshot"}</h3>
                  {editable && drafts[draftKey] !== undefined && (
                    <span className="unsaved">Unsaved changes</span>
                  )}
                </div>
                {(d.ownerId === actor || isAdmin) && typeof v.returnReason === "string" && v.returnReason.trim() && (
                  <aside className="feedback-box" aria-labelledby="revision-feedback-title">
                    <h3 id="revision-feedback-title">{v.status === "draft" ? "Requested changes" : "Revision feedback"}</h3>
                    <p>{v.returnReason}</p>
                    <p className="muted">{v.status === "draft" ? "This working revision is separate from the earlier submitted snapshot. Saving does not resubmit it." : "This feedback led to this revision. Earlier submitted snapshots remain unchanged."}</p>
                  </aside>
                )}
                <label className="sr-only" htmlFor="doc-content">
                  Document content
                </label>
                <textarea
                  id="doc-content"
                  readOnly={!editable}
                  value={value}
                  onChange={(e) => updateDraft(e.target.value)}
                  rows={17}
                />
                {!editable && (
                  <div className="inline-note">
                    <LockKeyhole size={17} />
                    <span>
                      Submitted and approved versions cannot be edited.
                    </span>
                  </div>
                )}
                {editable && (
                  <p className="helper">
                    Save Draft ≠ Complete ≠ Submit. Local recovery text is
                    retained until a confirmed save.
                  </p>
                )}
                <details>
                  <summary>Version history ({d.versions.length})</summary>
                  {d.versions.map((version: AnyRecord) => (
                    <div className="version-entry" key={version.version}>
                      <div className="inline">
                        <strong>Version {version.version}</strong>
                        <Status value={version.status} />
                      </div>
                      <p className="prewrap">{version.content}</p>
                    </div>
                  ))}
                </details>
                {d.ownerId === actor && d.canEdit !== false &&
                  v.status === "approved" &&
                  button("Start new working version", () =>
                    confirm(
                      "Start a new version?",
                      <p>
                        The approved v{v.version} stays read-only. The new
                        version will need its own review.
                      </p>,
                      () =>
                        action(
                          "beginRevision",
                          { projectId: p.id, documentId: d.id },
                          "New draft created. Earlier approval was not inherited.",
                        ),
                    ),
                  )}
                {editable && (
                  <button
                    onClick={() =>
                      confirm(
                        "Record task completion?",
                        <p>
                          This evaluation records your declaration only. Product
                          completion criteria are still open. It does not submit
                          this document.
                        </p>,
                        () =>
                          action(
                            "completeTask",
                            {
                              projectId: p.id,
                              taskId: d.taskId,
                              acknowledgeDemoRule: true,
                            },
                            "Demo completion recorded separately from submission.",
                          ),
                      )
                    }
                  >
                    {demo ? "Mark task complete · demo" : "Mark task complete"}
                  </button>
                )}
              </section>
              {isAdmin ? null : demo ? (
                <section className="panel padded assistant-panel">
                  <div className="inline spread">
                    <h3>Task assistant</h3>
                    <Status value="Simulation" />
                  </div>
                  <p className="helper">
                    Contextual example responses. No AI provider is connected.
                  </p>
                  <div
                    className="conversation"
                    role="log"
                    aria-label="Conversation history"
                  >
                    <div className="chat assistant">
                      <span>ASSISTANT · SIMULATED</span>
                      <p>
                        What do you know about this task, and which sources
                        support it? You decide what belongs in the document.
                      </p>
                    </div>
                    {conversation.map(
                      (m: { role: string; text: string }, i: number) => (
                        <div className={"chat " + m.role} key={i}>
                          <span>
                            {m.role === "user"
                              ? "YOU"
                              : "ASSISTANT · SIMULATED"}
                          </span>
                          <p>{m.text}</p>
                        </div>
                      ),
                    )}
                  </div>
                  <label>
                    Message
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Add context or ask a question…"
                    />
                  </label>
                  <div className="actions">
                    <button
                      aria-label="Voice setup information"
                      onClick={() =>
                        setModal({
                          title: "Conversational voice is not connected",
                          content: (
                            <>
                              <p>
                                Astra’s intended voice experience is a dialogue,
                                not dictation alone. Provider setup, languages,
                                retention and cost controls remain open. No
                                microphone is active.
                              </p>
                              <p>
                                Continue with text while these choices are
                                reviewed.
                              </p>
                              <button onClick={closeModal}>
                                Continue with text
                              </button>
                            </>
                          ),
                        })
                      }
                    >
                      <Mic size={17} />
                      Voice
                    </button>
                    <button
                      className="primary"
                      disabled={busy || !message.trim()}
                      onClick={async () => {
                        const sent = message;
                        const r = await action("simulateAi", {
                          projectId: p.id,
                          taskId: d.taskId,
                          message: sent,
                        });
                        if (r) {
                          const text =
                            r.reply ||
                            r.message ||
                            r.suggestion ||
                            r.draft ||
                            "Separate the reported problem, available evidence and open assumptions. Review this suggestion before using it.";
                          setConversation((c) => [
                            ...c,
                            { role: "user", text: sent },
                            {
                              role: "assistant",
                              text:
                                typeof text === "string"
                                  ? text
                                  : JSON.stringify(text),
                            },
                          ]);
                          setSuggestion(r.draft || r.suggestion || text);
                          setDrafts((ds) =>
                            ds[messageKey] === sent
                              ? { ...ds, [messageKey]: "" }
                              : ds,
                          );
                        }
                      }}
                    >
                      <Send size={16} />
                      Send
                    </button>
                  </div>
                  {suggestion && (
                    <div className="suggestion">
                      <h3>Review proposed draft</h3>
                      <label className="sr-only" htmlFor="suggestion">
                        Proposed draft
                      </label>
                      <textarea
                        id="suggestion"
                        value={suggestion}
                        onChange={(e) => setSuggestion(e.target.value)}
                        rows={5}
                      />
                      <p className="helper">
                        Suggestions are not verified research or human
                        decisions.
                      </p>
                      <button
                        disabled={!editable}
                        onClick={() => {
                          updateDraft(value + "\n\n" + suggestion);
                          setNotice(
                            "Suggestion added to your working draft. Review and save it.",
                          );
                        }}
                      >
                        Use in working draft
                      </button>
                    </div>
                  )}
                  <details>
                    <summary>Approved references</summary>
                    {p.documents.flatMap((doc: AnyRecord) =>
                      doc.versions
                        .filter((ver: AnyRecord) => ver.status === "approved")
                        .map((ver: AnyRecord) => (
                          <div
                            key={doc.id + ver.version}
                            className="version-entry"
                          >
                            <strong>
                              {doc.title} · v{ver.version}
                            </strong>
                            <p>{ver.content}</p>
                          </div>
                        )),
                    )}
                  </details>
                </section>
              ) : (
                <AssistantWorkspace
                  context={{
                    actorId: actor,
                    projectId: p.id,
                    projectName: p.name,
                    roleLabel: profileRoleLabel(state.currentActor),
                    scopeId: `document:${d.id}`,
                    scopeLabel: d.title,
                  }}
                />
              )}
            </div>
          </>
        );
      } else if (section === "submit") {
        const availableTasks = p.tasks.filter(
          (t: AnyRecord) =>
            t.ownerId === actor &&
            p.documents.some(
              (d: AnyRecord) =>
                d.taskId === t.id && d.canEdit !== false &&
                d.versions.some(
                  (v: AnyRecord) =>
                    v.version === d.workingVersion && v.status === "draft",
                ),
            ),
        );
        const selectedTask =
          availableTasks.find(
            (t: AnyRecord) => t.id === (parts[3] || submitTaskId),
          ) || availableTasks[0];
        const available = p.documents.filter(
          (d: AnyRecord) =>
            d.ownerId === actor && d.canEdit !== false &&
            d.taskId === selectedTask?.id &&
            d.versions.some(
              (v: AnyRecord) =>
                v.version === d.workingVersion && v.status === "draft",
            ),
        );
        const packageIds = selected.filter(id => available.some((d: AnyRecord) => d.id === id));
        const packageVersions = Object.fromEntries(available.map((d: AnyRecord) => [d.id, d.workingVersion]));
        body = (
          <section className="panel padded narrow">
            <h2>Review your submission</h2>
            <p>
              Choose saved document versions from one task. Excluded drafts stay
              in your workspace.
            </p>
            <label>
              Task for this package
              <select
                value={selectedTask?.id || ""}
                onChange={(e) => {
                  setSubmitTaskId(e.target.value);
                  setSelected([]);
                  navigate(`project/${p.id}/submit/${e.target.value}`);
                }}
              >
                {availableTasks.map((t: AnyRecord) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            {available.map((d: AnyRecord) => (
              <label className="check-row" key={d.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(d.id)}
                  onChange={(e) =>
                    setSelected((s) =>
                      e.target.checked
                        ? [...s, d.id]
                        : s.filter((id) => id !== d.id),
                    )
                  }
                />
                <div>
                  <strong>{d.title}</strong>
                  <span>Saved v{d.workingVersion}</span>
                </div>
                <Status value="Draft" />
              </label>
            ))}
            {!available.length && (
              <Empty title="No saved drafts available">
                Submitted versions are locked. A returned delivery creates a new
                working revision.
              </Empty>
            )}
            <div className="inline-note">
              <LockKeyhole size={18} />
              <span>
                Only selected saved versions are sent. Submitted content locks
                for review.
              </span>
            </div>
            <div className="form-footer">
              <button onClick={() => viewProject(p, "tasks")}>
                Back to tasks
              </button>
              <button
                className="primary"
                disabled={!packageIds.length || busy}
                onClick={() =>
                  confirm(
                    "Submit selected work?",
                    <p>
                      Send {packageIds.length} saved document
                      {packageIds.length === 1 ? "" : "s"} for review? Other
                      drafts remain outside this package. This does not publish
                      externally.
                    </p>,
                    async () => {
                      const checked = specialistDocumentAction(stateRef.current, p.id, actor, packageIds, packageVersions);
                      if (!checked.ok) { setError(checked.message); return; }
                      const r = await action(
                        "submitDocuments",
                        {
                          projectId: p.id,
                          documentIds: checked.documentIds,
                        },
                        "Selected versions submitted. The package is now read-only.",
                      );
                      if (r) viewProject(p, "reviews");
                    },
                    "Submit for review",
                  )
                }
              >
                <Send size={16} />
                Submit selected
              </button>
            </div>
          </section>
        );
      } else if (section === "review" && currentDelivery) {
        const d = currentDelivery;
        const pending = [
          "submitted",
          "under_review",
          "Submitted",
          "Under review",
        ].includes(d.status);
        body = (
          <>
            <div className="section-heading">
              <div>
                <div className="inline">
                  <h2>Delivery v{d.version}</h2>
                  <Status value={d.status} />
                </div>
                <p className="muted">
                  {pname(d.submittedBy)} · {d.documentVersions.length} included
                  documents · Immutable snapshot
                </p>
              </div>
              <span className="lock-label">
                <LockKeyhole size={16} />
                Read only
              </span>
            </div>
            <div className="review-grid">
              <section className="panel padded">
                {d.documentVersions.map((v: AnyRecord) => (
                  <article className="snapshot" key={v.documentId}>
                    <div className="inline spread">
                      <h3>{v.title}</h3>
                      <span className="muted">v{v.version}</span>
                    </div>
                    <p className="prewrap">{v.content}</p>
                  </article>
                ))}
                <div className="inline-note">
                  <FileText size={18} />
                  <span>
                    {d.excludedDocumentIds?.length || 0} excluded draft(s). They
                    are not part of this delivery.
                  </span>
                </div>
              </section>
              <aside className="panel padded decision-panel">
                <h2>Review decision</h2>
                <p className="muted">
                  Your decision applies to this exact package and version.
                </p>
                {d.feedback && (
                  <div className="feedback-box">
                    <strong>Requested changes</strong>
                    <p>{d.feedback}</p>
                  </div>
                )}
                {isAdmin && pending ? (
                  <AdminReviewActions key={p.id + ":" + d.id} version={d.version} documentCount={d.documentVersions.length} busy={busy || access.authBusy === true}
                    onDecision={async (type, reason) => {
                      const checked = prepareReviewDecision(stateRef.current, p.id, d, type, reason);
                      if (!checked.ok) { setError(checked.message); return false; }
                      return (await action(type, checked.payload, type === "approveDelivery" ? "Package approved. Tasks and PRD were not completed." : "Changes requested. A separate working revision is available to its owner.")) !== null;
                    }} />
                ) : (
                  <p className="helper">
                    {isAdmin
                      ? "This decision is recorded in the activity history."
                      : "The project administrator makes the review decision."}
                  </p>
                )}
                {d.status === "approved" && isAdmin && (
                  <button
                    className="full"
                    onClick={() => viewProject(p, "external")}
                  >
                    <Link2 size={16} />
                    Prepare external update
                  </button>
                )}
              </aside>
            </div>
          </>
        );
      } else if (section === "prd" && isAdmin)
        body = (
          <>
            <div className="section-heading">
              <div>
                <div className="inline">
                  <h2>Product requirements</h2>
                  <Status value={p.prd?.status || "Draft"} />
                </div>
                <p className="muted">
                  The PRD carries exact approved source versions.
                </p>
              </div>
              {button(
                "Prepare PRD draft",
                () =>
                  action(
                    "preparePrd",
                    { projectId: p.id },
                    "PRD draft prepared with the current source versions.",
                  ),
                true,
              )}
            </div>
            <section className="panel padded" aria-label="Required PRD sources">
              <h2>Required PRD sources</h2>
              <p>
                Select the documents this project requires before PRD closure.
                This is an explicit applicability decision, not an automatic
                eight-document rule.
              </p>
              {p.documents.length ? (
                p.documents.map((d: AnyRecord) => (
                  <label className="check-row" key={d.id}>
                    <input
                      type="checkbox"
                      disabled={busy}
                      checked={chosenSources.includes(d.id)}
                      onChange={(e) =>
                        setSourceSelections((all) => ({
                          ...all,
                          [p.id]: e.target.checked
                            ? [...chosenSources, d.id]
                            : chosenSources.filter((id: string) => id !== d.id),
                        }))
                      }
                    />
                    <div>
                      <strong>{d.title}</strong>
                      <span>{pname(d.ownerId)}</span>
                    </div>
                  </label>
                ))
              ) : (
                <p className="helper">
                  Create task documents before selecting sources.
                </p>
              )}
              <div className="form-footer">
                <p className="helper">
                  Changing sources invalidates the prepared PRD review. Prepare
                  and review a fresh draft before closure.
                </p>
                <button
                  disabled={busy || !p.documents.length}
                  onClick={() =>
                    confirm(
                      "Update required PRD sources?",
                      <p>
                        {chosenSources.length} documents will be required. Any
                        prepared PRD needs a fresh review.
                      </p>,
                      () =>
                        action(
                          "setRequiredSources",
                          { projectId: p.id, documentIds: chosenSources },
                          "Required sources updated. Prepare a fresh PRD draft.",
                        ),
                      "Update required sources",
                    )
                  }
                >
                  Save source selection
                </button>
              </div>
            </section>
            <div className="review-grid">
              <section className="panel padded">
                <h2>Required source readiness</h2>
                <p>
                  <strong>
                    {p.prd?.readiness?.approved ?? 0} of{" "}
                    {p.prd?.readiness?.total ?? 0}
                  </strong>{" "}
                  applicable required sources approved
                </p>
                <progress
                  aria-label="Required source readiness"
                  value={p.prd?.readiness?.approved ?? 0}
                  max={p.prd?.readiness?.total || 1}
                />
                <div className="source-list">
                  {(p.prd?.requiredSourceIds || []).map((id: string) => {
                    const d = p.documents.find((d: AnyRecord) => d.id === id);
                    const v =
                      d?.versions.find(
                        (v: AnyRecord) => v.version === d.workingVersion,
                      ) || d?.versions.at(-1);
                    return (
                      <div className="source-row" key={id}>
                        <FileText size={19} />
                        <div className="grow">
                          <SourceDocumentPreviewLink title={d?.title || id} />
                          <span>Source v{v?.version ?? "—"}</span>
                        </div>
                        <Status value={v?.status || "Missing"} />
                        <SourceSubmissionDate
                          project={p}
                          documentId={id}
                          version={v?.version}
                        />
                      </div>
                    );
                  })}
                </div>
                {p.prd?.content && (
                  <article className="prd-preview">
                    <h2>{p.prd.status === "closed" ? "Closed PRD" : "PRD draft"} v{p.prd.version}</h2>
                    <p className="helper">
                      Prepared by {pname(p.prd.preparedBy)}. {p.prd.status === "closed"
                        ? "This is the recorded closed version."
                        : "Review this exact content before closure."}
                    </p>
                    <div className="prewrap">{p.prd.content}</div>
                  </article>
                )}
                <p className="helper">
                  {demo
                    ? "Applicable sources come from this synthetic fixture. Eight sources is not a universal rule."
                    : "Required sources are explicitly selected by this project’s Admin above."}
                </p>
              </section>
              <aside className="panel padded">
                <h2>Close PRD v{p.prd?.version || 1}</h2>
                <p>
                  Admin / PM confirms the PRD and its source versions. Closure
                  does not authorize task creation or deployment.
                </p>
                {!p.prd?.readiness?.ready && (
                  <div className="inline-note">
                    <AlertCircle size={18} />
                    <span>
                      {p.prd?.readiness?.changedSources
                        ? "Sources changed after preparation. Prepare and review a fresh PRD draft."
                        : "Required sources are incomplete. You can prepare a draft, but cannot close it."}
                    </span>
                  </div>
                )}
                {button(
                  "Review & close PRD",
                  () =>
                    confirm(
                      `Close PRD v${p.prd.version}?`,
                      <>
                        <p>
                          Confirm the approved source versions listed here. The
                          service checks they have not changed before recording
                          closure.
                        </p>
                        <p>
                          {Array.isArray(sources(p))
                            ? sources(p)
                                .map(
                                  (s: AnyRecord) =>
                                    `${s.documentId || s.id} v${s.version}`,
                                )
                                .join(", ")
                            : JSON.stringify(sources(p))}
                        </p>
                      </>,
                      () =>
                        action(
                          "closePrd",
                          {
                            projectId: p.id,
                            prdVersion: p.prd.version,
                            sourceVersions: p.prd.sourceVersions,
                          },
                          `PRD v${p.prd.version} closed with verified source versions.`,
                        ),
                      "Close exact PRD",
                    ),
                  true,
                  !p.prd?.readiness?.ready || p.prd?.status === "closed",
                )}
                <details>
                  <summary>PRD history</summary>
                  <pre>{JSON.stringify(p.prd?.history || [], null, 2)}</pre>
                </details>
              </aside>
            </div>
            {!p.prd?.content && <section className="panel padded" aria-label="PRD content">
              <h2>No PRD content prepared yet</h2>
              <p className="muted">Select the required sources, then prepare a PRD draft to review its recorded content.</p>
            </section>}
          </>
        );
      else if (
        section === "questionnaire" &&
        p.questionnaire?.assignedTo === actor
      ) {
        body = <StakeholderQuestionnaire key={actor + ':' + p.id} p={p} actor={actor}
          roleLabel={profileRoleLabel(state.currentActor)} drafts={drafts} setDrafts={setDrafts}
          busy={busy} action={action} viewProject={viewProject} setModal={setModal} closeModal={closeModal} />;
      } else if (section === "external" && !demo) {
        body = (
          <section className="panel padded">
            <h2>Linked task activity</h2>
            <p>
              External task providers are not connected. No publishing,
              synchronization or simulation is available in this account
              workspace.
            </p>
            <p className="helper">
              Your saved project work stays in Astra. Connecting a provider and
              reviewing a specific destination are separate setup steps.
            </p>
          </section>
        );
      } else if (section === "external") {
        const chosenTask =
          p.tasks.find((t: AnyRecord) => t.id === externalTaskId) || p.tasks[0];
        const eligibleDeliveries = p.deliveries.filter(
          (d: AnyRecord) =>
            d.status === "approved" &&
            d.documentVersions.every(
              (v: AnyRecord) =>
                p.documents.find((doc: AnyRecord) => doc.id === v.documentId)
                  ?.taskId === chosenTask?.id,
            ),
        );
        const approvedDelivery =
          eligibleDeliveries.find(
            (d: AnyRecord) => d.id === externalDeliveryId,
          ) || eligibleDeliveries[0];
        const extKey = "external:" + actor + ":" + p.id + ":" + chosenTask?.id;
        const externalContent = drafts[extKey] || "";
        const setExternalContent = (value: string) =>
          setDrafts((ds) => ({ ...ds, [extKey]: value }));
        body = (
          <>
            <div className="section-heading">
              <div>
                <h2>Linked task activity</h2>
                <p className="muted">
                  ClickUp simulation · No provider is connected and nothing is
                  sent externally.
                </p>
              </div>
              <Status value="Simulation only" />
            </div>
            <div className="review-grid">
              <section className="panel padded">
                <h2>Review an external action</h2>
                <label>
                  Linked task
                  <select
                    value={chosenTask?.id || ""}
                    onChange={(e) => {
                      setExternalTaskId(e.target.value);
                      setExternalDeliveryId("");
                    }}
                  >
                    {p.tasks.map((t: AnyRecord) => (
                      <option value={t.id} key={t.id}>
                        {t.title} · {t.linkedTaskId || t.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Comment or update summary
                  <textarea
                    rows={5}
                    value={externalContent}
                    onChange={(e) => setExternalContent(e.target.value)}
                    placeholder="Review the exact content before preparing an action."
                  />
                </label>
                <label>
                  Approved delivery for this task
                  <select
                    value={approvedDelivery?.id || ""}
                    onChange={(e) => setExternalDeliveryId(e.target.value)}
                  >
                    <option value="">
                      {eligibleDeliveries.length
                        ? "Select an approved delivery"
                        : "No approved delivery for this task"}
                    </option>
                    {eligibleDeliveries.map((d: AnyRecord) => (
                      <option value={d.id} key={d.id}>
                        Delivery v{d.version} ·{" "}
                        {d.documentVersions
                          .map((v: AnyRecord) => v.title + " v" + v.version)
                          .join(", ")}
                      </option>
                    ))}
                  </select>
                </label>
                {approvedDelivery && (
                  <p className="helper">
                    Source versions:{" "}
                    {approvedDelivery.documentVersions
                      .map((v: AnyRecord) => v.title + " v" + v.version)
                      .join("; ")}
                  </p>
                )}
                {isAdmin ? (
                  <div className="actions">
                    <button
                      disabled={busy || !externalContent.trim() || !chosenTask}
                      onClick={() =>
                        action(
                          "previewExternal",
                          {
                            projectId: p.id,
                            kind: "comment",
                            taskId: chosenTask.id,
                            content: externalContent,
                          },
                          "Simulated comment prepared. Review its target before publishing.",
                        )
                      }
                    >
                      Preview comment
                    </button>
                    <button
                      disabled={
                        busy || !approvedDelivery || !externalContent.trim()
                      }
                      onClick={() =>
                        action(
                          "previewExternal",
                          {
                            projectId: p.id,
                            kind: "approvedUpdate",
                            taskId: chosenTask.id,
                            deliveryId: approvedDelivery.id,
                            content: externalContent,
                          },
                          "Simulated approved-version update prepared.",
                        )
                      }
                    >
                      Preview approved update
                    </button>
                  </div>
                ) : (
                  <p className="helper">
                    Project Admin reviews external publishing in this
                    evaluation.
                  </p>
                )}
                <div className="inline-note">
                  <AlertCircle size={18} />
                  <span>
                    Task creation from a closed PRD requires an agreed mapping,
                    assignment policy and authorized ClickUp destination. Those
                    decisions remain open.
                  </span>
                </div>
              </section>
              <section className="panel padded">
                <h2>Recovery scenario</h2>
                <p className="muted">
                  Choose a simulated provider result to test safe recovery.
                </p>
                <label>
                  Next publication outcome
                  <select
                    value={externalOutcome}
                    onChange={(e) => setExternalOutcome(e.target.value)}
                  >
                    <option value="success">Confirmed success</option>
                    <option value="failure">Confirmed failure</option>
                    <option value="uncertain_written">
                      Timeout after write
                    </option>
                    <option value="uncertain_missing">
                      Timeout before write
                    </option>
                  </select>
                </label>
                <p className="helper">
                  Unknown outcomes must be checked before retry. Document
                  approval stays unchanged.
                </p>
              </section>
            </div>
            <section className="panel padded">
              <h2>External operation history</h2>
              {p.externalOperations.length ? (
                p.externalOperations.map((o: AnyRecord) => (
                  <div className="operation" key={o.id}>
                    <div className="inline spread">
                      <strong>
                        {o.kind === "comment"
                          ? "Task comment"
                          : "Approved-version update"}{" "}
                        · {o.linkedTaskId}
                      </strong>
                      <Status value={o.status} />
                    </div>
                    <p>{o.content}</p>
                    <p className="helper">
                      Provider: {o.provider || "ClickUp"} · Source versions:{" "}
                      {(o.sourceVersions || [])
                        .map((v: AnyRecord) => v.documentId + " v" + v.version)
                        .join(", ") || "Task comment"}{" "}
                      · Operation: {o.id}
                    </p>
                    {o.approvedLink && (
                      <p className="helper">
                        Approved document access is a local simulation only.
                        External access policy is unresolved.
                      </p>
                    )}
                    {isAdmin && (
                      <div className="actions">
                        {o.status === "pending" &&
                          button(
                            "Authorize simulated publish",
                            () =>
                              confirm(
                                "Publish this simulated action?",
                                <>
                                  <p>
                                    Target: {o.provider || "ClickUp"} / {p.name}{" "}
                                    / {o.linkedTaskId}
                                  </p>
                                  <p>{o.content}</p>
                                  <p>
                                    Sources:{" "}
                                    {(o.sourceVersions || [])
                                      .map(
                                        (v: AnyRecord) =>
                                          v.documentId + " v" + v.version,
                                      )
                                      .join(", ") || "Task comment"}
                                  </p>
                                  <p>
                                    Evaluation only. No real provider receives
                                    this action.
                                  </p>
                                </>,
                                () =>
                                  action(
                                    "publishExternal",
                                    {
                                      projectId: p.id,
                                      operationId: o.id,
                                      authorized: true,
                                      outcome: externalOutcome,
                                    },
                                    "Simulated provider outcome recorded.",
                                  ),
                                "Publish simulation",
                              ),
                            true,
                          )}
                        {o.status === "uncertain" &&
                          button("Check provider result", () =>
                            action(
                              "checkExternal",
                              { projectId: p.id, operationId: o.id },
                              "Simulated provider checked before any retry.",
                            ),
                          )}
                        {o.status === "failed" &&
                          button("Retry same operation", () =>
                            action(
                              "retryExternal",
                              {
                                projectId: p.id,
                                operationId: o.id,
                                outcome: externalOutcome,
                              },
                              "Same target and content retried without changing approval.",
                            ),
                          )}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <Empty title="No external actions yet">
                  Draft saves and approvals do not publish automatically.
                </Empty>
              )}
            </section>
          </>
        );
      } else if (section === "audit")
        body = isAdmin ? (
          <AdminActivity p={p} personName={pname} />
        ) : (
          <section className="panel padded">
            <h2>Project activity</h2>
            <p className="muted">
              A traceable record of exact versions and human decisions.
            </p>
            <ol className="timeline">
              {p.audit
                .slice()
                .reverse()
                .map((a: AnyRecord, i: number) => (
                  <li key={a.id || i}>
                    <span className="timeline-dot" />
                    <div>
                      <strong>{a.message || a.action || a.type}</strong>
                      <p>
                        {a.details
                          ? typeof a.details === "string"
                            ? a.details
                            : JSON.stringify(a.details)
                          : ""}
                      </p>
                      <span className="helper">
                        {pname(a.actorId || a.actor)} ·{" "}
                        {new Date(
                          a.at || a.timestamp || Date.now(),
                        ).toLocaleString("en-US", { timeZone: "UTC" })}
                      </span>
                    </div>
                  </li>
                ))}
            </ol>
          </section>
        );
      else
        body = (
          <Empty title="This view is unavailable">
            Return to the project overview to continue.
          </Empty>
        );
      content = (
        <>
          {projectHeader}
          {isAdmin && (section === "reviews" || section === "team") ? (
            body
          ) : isAdmin &&
            section !== "overview" &&
            (ADMIN_SECTIONS.some((key) => key === section) ||
              section === "review") ? (
            <div className="admin-overview-layout">
              <div className="admin-project-content">{body}</div>
              <AdminProjectToolsRail
                p={p}
                actorId={actor}
                personName={pname}
                scopeLabel={
                  ADMIN_SECTION_LABELS[section] || "Deliverable review"
                }
              />
            </div>
          ) : isAdmin && section !== "overview" ? (
            <div className="admin-project-layout">
              <div className="admin-project-content">{body}</div>
              <aside className="admin-assistant-rail" aria-label="AI Assistant">
                <AdminAssistantPanel
                  context={{
                    actorId: actor,
                    projectId: p.id,
                    projectName: p.name,
                    roleLabel: "Admin",
                    scopeId: "project",
                    scopeLabel:
                      ADMIN_SECTION_LABELS[section] || "Deliverable review",
                  }}
                />
              </aside>
            </div>
          ) : (
            body
          )}
        </>
      );
    } else
      content = (
        <Empty title="Project not accessible">
          Choose an assigned project from your dashboard.
        </Empty>
      );
  }
  const signOutButton = (
    <button
      className="text-button sign-out"
      disabled={busy || access.authBusy || exampleActive}
      onClick={() => {
        if (hasAssistantDrafts || hasWireframeDrafts)
          confirm(
            "Discard local drafts and sign out?",
            <p>
              Assistant and quick-wireframe drafts live only in this tab. Export
              them first if you want to keep them. Saved project data is not
              deleted.
            </p>,
            async () => onSignOut(),
            "Sign out",
          );
        else onSignOut();
      }}
    >
      Sign out
    </button>
  );
  return (
    <div className={"app-shell" + (!isAdmin && project?.questionnaire?.assignedTo === actor ? " stakeholder-connected-shell" : "")}>
      {addPersonOpen && state && contract.features.accountRegistration && (
        <PersonDialog
          accounts={(state.accounts || []) as Account[]}
          actorId={actor}
          action={action}
          errorMessage={error}
          busy={busy}
          invitationEnabled={
            state.capabilities.inviteAccounts === true ||
            state.invitationConfiguration?.enabled === true
          }
          invitationReason={
            state.capabilities.inviteUnavailableReason ||
            state.invitationConfiguration?.reason
          }
          onClose={() => setAddPersonOpen(false)}
        />
      )}
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          main.current?.focus();
        }}
      >
        Skip to main content
      </a>
      <aside
        id="primary-sidebar"
        className={"sidebar " + (sidebar ? "open" : "")}
      >
        <button
          className="brand"
          disabled={exampleActive}
          onClick={() => navigate("projects")}
          aria-label="Astra Systems home"
        >
          {logo}
        </button>
        <nav aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          <button
            className={route === "projects" ? "selected" : ""}
            disabled={exampleActive}
            onClick={() => navigate("projects")}
          >
            <LayoutDashboard size={19} />
            Projects
          </button>
        </nav>
        <div className="sidebar-bottom">
          <SidebarCollapse />
          <button
            className="profile"
            disabled={exampleActive}
            onClick={() => navigate("settings")}
          >
            <span className="avatar">
              {state?.currentActor?.name
                ?.split(" ")
                .map((s: string) => s[0])
                .slice(0, 2)
                .join("") || "AS"}
            </span>
            <span>
              <strong>{state?.currentActor?.name || "Loading…"}</strong>
              <small>{profileRoleLabel(state?.currentActor)}</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="inline">
            <button
              className="mobile-menu icon-button"
              aria-label="Toggle navigation"
              aria-controls="primary-sidebar"
              aria-expanded={sidebar}
              onClick={() => setSidebar((v) => !v)}
            >
              <PanelLeft size={20} />
            </button>
            {isAdmin ? (
              <AdminBreadcrumb
                example={exampleActive}
                route={route}
                projectName={project?.name}
                onProjects={() => navigate("projects")}
                onProject={() => project && viewProject(project, "overview")}
              />
            ) : (
              <span className="breadcrumb">
                Workspace <ChevronRight size={14} />{" "}
                {exampleActive
                  ? "Demo"
                  : project
                    ? project.name
                    : route === "settings"
                      ? "Settings"
                      : route === "logs"
                        ? "Logs"
                        : route === "create"
                          ? "Create project"
                          : "Projects"}
              </span>
            )}
          </div>
          <div className="topbar-actions">
            {demo && <span className="demo-pill">DEMO</span>}
            {isAdmin && !demo && (
              <button
                type="button"
                className="admin-example-toggle"
                role="switch"
                aria-checked={exampleActive}
                aria-label="Demo example"
                disabled={
                  busy ||
                  access.authBusy ||
                  !!modal ||
                  addPersonOpen ||
                  Object.keys(pendingRequests.current).length > 0
                }
                onClick={toggleExample}
              >
                <span>Demo</span>
                <span className="admin-example-switch-track" aria-hidden="true">
                  <span />
                </span>
                <span aria-hidden="true">{exampleActive ? "On" : "Off"}</span>
              </button>
            )}
            {isAdmin && !demo && (
              <label className="admin-language">
                <span className="sr-only">Interface language</span>
                <select
                  aria-label="Interface language"
                  value="en"
                  onChange={() => {}}
                  title="English is the only supported language for now."
                >
                  <option value="en">English</option>
                </select>
              </label>
            )}

            <button
              className="icon-button"
              aria-label="Refresh workspace"
              disabled={busy || exampleActive}
              onClick={refreshWorkspace}
            >
              <RefreshCw size={18} />
            </button>
            {!isAdmin && signOutButton}
            <button
              className="icon-button"
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              onClick={() =>
                setTheme((t) => (t === "light" ? "dark" : "light"))
              }
            >
              {theme === "light" ? <Moon size={19} /> : <Sun size={19} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              disabled={exampleActive}
              onClick={() =>
                setModal({
                  title: "Delivery notifications",
                  content: (
                    <>
                      <p className="muted">
                        Opening a notice does not resolve its review.
                      </p>
                      {state?.projects.flatMap((p) =>
                        p.deliveries
                          .filter((d: AnyRecord) =>
                            ["submitted", "under_review"].includes(d.status),
                          )
                          .map((d: AnyRecord) => (
                            <button
                              className="notification-row"
                              key={d.id}
                              onClick={async () => {
                                closeModal();
                                const note = p.notifications?.find(
                                  (n: AnyRecord) => n.deliveryId === d.id,
                                );
                                if (
                                  note &&
                                  (await action("readNotice", {
                                    projectId: p.id,
                                    noticeId: note.id,
                                  })) === null
                                )
                                  return;
                                if (
                                  (demo
                                    ? p.isAdmin
                                    : canShowProjectAdminActions(state, p)) &&
                                  ["submitted", "under_review"].includes(
                                    d.status,
                                  )
                                ) {
                                  if (
                                    (await action("openReview", {
                                      projectId: p.id,
                                      deliveryId: d.id,
                                    })) === null
                                  )
                                    return;
                                }
                                navigate(`project/${p.id}/review/${d.id}`);
                              }}
                            >
                              <Bell size={18} />
                              <span>
                                <strong>
                                  {p.name} · Delivery v{d.version}
                                </strong>
                                <small>
                                  {d.documentVersions.length} documents ready
                                  for review
                                </small>
                              </span>
                              <ChevronRight size={16} />
                            </button>
                          )),
                      )}
                      {!state?.projects.some((p) =>
                        p.deliveries.some((d: AnyRecord) =>
                          ["submitted", "under_review"].includes(d.status),
                        ),
                      ) && <p>No pending delivery notices.</p>}
                    </>
                  ),
                })
              }
            >
              <Bell size={19} />
              {state?.projects.some((p) => p.summary?.needsReview > 0) && (
                <span className="notification-dot" />
              )}
            </button>
            {isAdmin && (
              <button
                type="button"
                className="icon-button"
                aria-label="Profile"
                disabled={exampleActive}
                onClick={() => navigate("settings")}
              >
                <span className="avatar admin-header-avatar">
                  {state?.currentActor?.name
                    ?.split(" ")
                    .map((word: string) => word[0])
                    .slice(0, 2)
                    .join("") || "AS"}
                </span>
              </button>
            )}
            {isAdmin && signOutButton}
          </div>
        </header>
        <main id="main-content" ref={main} tabIndex={-1}>
          {access.authError && (
            <div className="alert error" role="alert">
              <AlertCircle size={20} />
              <p>{access.authError}</p>
            </div>
          )}
          {!exampleActive && error && (
            <div className="alert error" role="alert">
              <AlertCircle size={20} />
              <div>
                <strong>We could not complete that action</strong>
                <p>{error}</p>
                {!demo && Object.keys(pendingRequests.current).length > 0 && (
                  <button disabled={busy} onClick={checkPending}>
                    Check saved result
                  </button>
                )}
              </div>
              <button
                aria-label="Dismiss error"
                className="icon-button"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {!exampleActive && notice && (
            <div className="alert success" role="status">
              <CheckCircle2 size={20} />
              <p>{notice}</p>
              <button
                aria-label="Dismiss notification"
                className="icon-button"
                onClick={() => setNotice("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {exampleActive && (
            <AdminExamplePreview onDraftsChange={setExampleHasDrafts} />
          )}
          <div
            className="real-workspace-view"
            hidden={exampleActive}
            inert={exampleActive}
          >
            {state ? (
              content
            ) : (
              <div className="loading" role="status">
                Loading your workspace…
              </div>
            )}
          </div>
        </main>
        <footer className="app-footer">
          <span>Astra System · Owned and powered by WiseCursor</span>
          {!exampleActive && (
            <span>
              {demo ? "Local evaluation" : "Verified accounts · Shared storage"}{" "}
              · No live AI or task integrations
            </span>
          )}
        </footer>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) closeModal();
        }}
        aria-labelledby="modal-title"
      >
        <div className="modal-heading">
          <h2 id="modal-title">{modal?.title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={closeModal}
          >
            <X size={20} />
          </button>
        </div>
        {modal?.content}
      </dialog>
    </div>
  );
}

document.documentElement.dataset.theme =
  localStorage.getItem("astra-new-theme") === "dark" ? "dark" : "light";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthGate>
      {(actor, onSignOut, access) => (
        <AssistantDraftProvider key={access.mode + actor} actorId={actor}>
          <App
            key={access.mode + actor}
            actor={actor}
            onSignOut={onSignOut}
            access={access}
          />
        </AssistantDraftProvider>
      )}
    </AuthGate>
  </React.StrictMode>,
);
