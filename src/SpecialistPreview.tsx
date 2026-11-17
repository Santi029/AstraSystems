import React, { useMemo, useRef, useState } from "react";
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
import { SpecialistActivity } from "./SpecialistActivity";
import { SpecialistMyTasks } from "./SpecialistMyTasks";
import { SpecialistTeamPreview } from "./SpecialistTeamPreview";
import { AdminReferenceDocuments } from "./AdminReferenceDocuments";
import "./specialist-preview.css";
import "./stakeholder-preview.css";

const PEOPLE = [
  {
    id: "specialist-preview-sam",
    name: "Sam Example",
    email: "sam@example.test",
  },
  {
    id: "specialist-preview-alex",
    name: "Alex Example",
    email: "alex@example.test",
  },
  {
    id: "specialist-preview-maya",
    name: "Maya Example",
    email: "maya@example.test",
  },
  {
    id: "specialist-preview-owen",
    name: "Owen Example",
    email: "owen@example.test",
  },
];
const PROJECT = {
  id: "specialist-preview-capacity",
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
    { personId: PEOPLE[0].id, roles: ["Specialist"] },
    { personId: PEOPLE[1].id, roles: ["Admin"] },
    { personId: PEOPLE[2].id, roles: ["UX Designer"] },
    { personId: PEOPLE[3].id, roles: ["Full Stack Development"] },
  ],
};
const DEMO_DOCUMENT_SECTIONS = [{"title": "1. Discovery context and objectives", "body": "This demonstration document describes an imaginary capacity planning workspace created only to evaluate document layout, reading comfort, and review interactions. It does not represent a real institution, customer, system, or delivery commitment. The proposed workspace would help a small cross-functional team collect assumptions, compare observations, and identify questions before implementation begins. Its immediate objective is to make incomplete information visible rather than hide it behind a polished interface. Participants would describe the problem in their own words, identify the people affected, and explain what a successful outcome might look like. A facilitator would then group similar statements, record disagreements, and distinguish confirmed observations from hypotheses that still require research. The discovery process would begin with short interviews and a review of existing, authorized project materials. Each observation would retain its source and date so later readers could understand its context. When participants disagree, the document would preserve both perspectives and identify the decision that is needed. The interface should make this material easy to scan without forcing every reader to study every paragraph. Headings, short summaries, and consistent spacing would support that goal. This sample deliberately includes substantial prose so reviewers can assess the available reading width, scrolling behavior, and relationship between the document and the tools alongside it."}, {"title": "2. User needs and proposed workflow", "body": "In this fictional scenario, a specialist needs a clear place to start work, a reliable way to keep personal tasks separate from team submissions, and enough context to understand why a document is being prepared. The first interaction would be choosing a recommended task or entering a custom task name. A task would then open a dedicated document workspace rather than an approval dialog. That distinction matters because writing and reviewing are different activities with different responsibilities. While drafting, the specialist could consult reference material and explore available assistance without losing the document they are working on. Any suggestions from a future assistant would need to remain reviewable before being incorporated into the final text. The specialist would decide whether a suggestion is useful, accurate, and relevant to the task. The current preview does not connect to such an assistant or store these decisions. It simply illustrates where those interactions could appear. Team deliverables would be available in a separate reading view, with the author, submission date, and recorded status visible. Comments would help explain questions and revisions, but the specialist would not receive administrative approval controls. A compact empty comment area would avoid wasting space on documents with no discussion. As comments accumulate in a future connected implementation, the history could expand naturally while keeping authorship and ordering understandable. These statements are illustrative workflow assumptions, not approved product requirements."}, {"title": "3. Open questions and review considerations", "body": "Before turning this example into an implementation plan, the team would need to validate several assumptions. It would need to define who can view each document, which project roles may contribute comments, and how a reviewer distinguishes a working draft from a submitted version. It would also need to determine how version history is preserved when a document changes after feedback. Those decisions should be documented explicitly rather than inferred from the appearance of a button. For the current visual review, the main questions are simpler: is the document comfortable to read, is the title sufficiently prominent, and can a reader find the next relevant action without confusion? The review should examine both light and dark appearances and check how longer passages behave on smaller screens. Tables, links, and any future attachments would need separate accessibility and interaction testing. This demonstration contains no real measurements, personal information, financial records, or confidential project details. Its content is intentionally generic and should not be treated as evidence about a real system. A later project team could replace these sections with verified findings, source references, and agreed requirements. Until that happens, the appropriate outcome is a clear list of questions and a shared understanding of the interface. The purpose of this long example is to expose layout limitations early, while revisions remain inexpensive and do not affect live project data."}];
const PRD_DEMO_SECTIONS = [
["1. Product purpose","This fictional product requirements document demonstrates how a longer PRD could appear inside Astra. The example describes a shared capacity planning workspace for an imaginary team. Its purpose is to collect user needs, organize technical assumptions, and make project progress understandable. Nothing in this document represents a real bank, customer, production system, or approved commitment. Readers should evaluate the visual hierarchy, line length, spacing, and scrolling experience rather than treat the content as a specification ready for implementation. A future connected workflow would replace these paragraphs with reviewed source material and record who approved each version."],
["2. Problem statement","The imaginary team currently receives project context through separate conversations and documents. Participants may interpret the same request differently, and important assumptions can become difficult to locate. The proposed workspace would bring these materials together while preserving their origins. It would distinguish working notes from submitted deliverables and approved references. This sample assumes that a clearer overview could reduce repeated clarification, but that assumption would require research. The document therefore separates the perceived problem from a confirmed business outcome. No real performance measurements or confidential observations are used in this example."],
["3. Goals and success criteria","The illustrative goals are to make assigned work visible, support consistent documentation, and help participants understand which decisions remain unresolved. Success criteria would eventually need agreed definitions, a measurement method, and an accountable reviewer. For visual purposes, this template shows where those criteria could be described without inventing numerical targets. A future team might evaluate whether users can locate an assigned task, understand a deliverable status, and find the latest approved reference. These examples are prompts for discussion rather than guarantees about the product. They should be validated before development estimates are treated as commitments."],
["4. Users and responsibilities","The example distinguishes an administrator who coordinates the project, a stakeholder who supplies context and reviews progress, and specialists who prepare their own contributions. Each person should see actions appropriate to their responsibilities. A specialist can consult another participant’s deliverable without receiving administrative approval controls. The administrator can review submissions without being presented as their author. A stakeholder should be able to understand progress without navigating every technical detail. These descriptions are illustrative and do not establish account permissions. Real authorization rules must be implemented and tested separately from the appearance of this prototype."],
["5. Scope and exclusions","The proposed visual scope includes project navigation, personal task selection, document drafting, team reference material, and a readable activity history. The current preview intentionally excludes live AI assistance, external notifications, durable document storage, and production access control. Buttons and fields demonstrate possible interactions only where their behavior is explicitly described. A future implementation would require separate integration work and acceptance testing. This boundary helps reviewers distinguish a useful interface concept from a completed operational system. Additional capabilities should be assessed deliberately rather than inferred from a mock screen or added merely because space is available."],
["6. Core workflows","A specialist begins with the project overview and moves to My Tasks when creating work. A custom name or recommended task can establish a local preview item. Opening that item leads to a document workspace rather than a review modal. Team submissions remain in Deliverables, where the reader can inspect content and its recorded context. The PRD view assembles an understandable representation of the project requirements without granting editing powers to every reader. Each transition should preserve the distinction between personal work and shared records. This paragraph describes an illustrative flow and does not claim that submissions or approvals are connected."],
["7. Information and source material","Future project content may include notes, reference documents, diagrams, and links supplied by authorized participants. Each contribution should retain sufficient context to identify its source, date, and relevant version. An approved reference must not silently change when its working draft is edited. Readers should be able to tell whether they are viewing an example, a draft, a submitted document, or an approved version. This demonstration uses only invented material and reserved example identities. No private files, financial details, customer records, or actual project information have been copied into the template."],
["8. Quality and accessibility","The interface should remain readable across light and dark appearances and on narrower screens. Content must not rely on color alone to communicate its state. Headings, labels, keyboard focus, and clear actions should help readers understand the document and move through the workspace. Long passages should wrap naturally, while wide tables may require a controlled horizontal scrolling region. Real quality criteria would need explicit tests and agreed thresholds. This sample is intended to reveal layout issues early, not certify accessibility or performance. Any connected release would require its own verification using representative users and data."],
["9. Dependencies and open questions","The eventual implementation would depend on decisions about authentication, project permissions, document versioning, storage, and integration boundaries. The team would also need to decide how comments are retained and how source documents contribute to a PRD revision. Open questions should remain visible until an authorized person resolves them. A visually complete screen does not settle these decisions. This template provides space to record the question, the reason it matters, and the next verification step. It deliberately avoids assigning real owners or deadlines that have not been agreed. All content here remains fictional and provisional."],
["10. Review and next steps","Reviewers can use this long example to assess whether the PRD is comfortable to read within the available main area and alongside the assistance tools. They should note confusing labels, overly narrow passages, and places where document boundaries are unclear. After the visual structure is accepted, a real project team could replace the sample with researched requirements and traceable sources. The next stage would define acceptance criteria, validate permissions, and test connected workflows. Until then, this document remains a demonstration of presentation only. It is neither a final PRD nor evidence that any real project work has been completed."]
]
;
const TABS = [
  "Overview",
  "My Tasks",
  "Deliverables",
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
      aria-label="Specialist AI tools"
    >
      <div className="admin-overview-rail-content" inert={tool !== null}>
        <AdminAgentToolbox onFocusChat={() => open("Chat")} onOpenTool={open} />
        <AdminReferenceDocuments p={{...PROJECT, documents: [{id:"example-reference",title:"Project brief",ownerId:PEOPLE[1].id,versions:[{version:1,status:"approved",content:"Illustrative capacity planning brief. Example content only.",approvedAt:"2027-03-12T15:00:00Z",savedAt:"2027-03-12T14:00:00Z"}]}]}} personName={id => PEOPLE.find(p=>p.id===id)?.name || id} />
      </div>
      {tool && (
        <AdminAssistantDrawer
          rail={rail}
          tool={tool}
          context={{
            actorId: PEOPLE[0].id,
            projectId: PROJECT.id,
            projectName: PROJECT.name,
            roleLabel: "Specialist",
            scopeId: "specialist-preview-" + scope,
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
function SpecialistApp() {
  const [screen, setScreen] = useState<"projects" | "project">("projects"),
    [tab, setTab] = useState<Tab>("Overview");
  const [dark,setDark]=useState(false),[query,setQuery]=useState("");
  const [selected,setSelected]=useState<string[]>([]),[custom,setCustom]=useState("");
  const [tasks,setTasks]=useState<{id:string;title:string;created:string;updated:string;body:string}[]>([]);
  const [detail,setDetail]=useState<{kind:"task"|"delivery";id:string}|null>(null);
  const taskProject=useMemo(()=>({...PROJECT,tasks:tasks.map(t=>({...t,ownerId:PEOPLE[0].id,status:"draft",createdAt:t.created,updatedAt:t.updated}))}),[tasks]);
  const [activityQuery,setActivityQuery]=useState("");
  const [notice,setNotice]=useState("");
  const open=(next:Tab="Overview")=>{setScreen("project");setTab(next);setDetail(null);setNotice("");};
  const addTasks=(names:string[])=>{const now=new Date().toISOString();setTasks(old=>[...old,...names.filter(n=>n.trim()&&!old.some(t=>t.title===n)).map((title,i)=>({id:now+"-"+i,title,created:now,updated:now,body:""}))]);setSelected([]);setNotice("Added to this preview session only. Nothing was saved to the project.");};
  const date=(value:string)=>new Date(value).toLocaleString("en-US",{dateStyle:"medium",timeStyle:"short"});
  const taskTable=()=>tasks.length ? <div className="table-wrap"><table><thead><tr><th>My task</th><th>Created</th><th>Last Updated</th><th>Work Status</th><th>Action</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.title}</td><td>{date(t.created)}</td><td>{date(t.updated)}</td><td><span className="status neutral">Draft</span></td><td><button onClick={()=>setDetail({kind:"task",id:t.id})}>Open</button></td></tr>)}</tbody></table></div> : <div className="specialist-empty"><h3>Create your first task</h3><p className="muted">Choose a recommendation or add a custom task in My Tasks.</p><button className="primary" onClick={()=>open("My Tasks")}>Go to My Tasks</button></div>;
  const deliveries=[{id:"ux-brief",title:"Discovery handoff",author:"Maya Example",status:"Pending review",date:"Mar 12, 2027",body:"Example discovery notes: validate peak demand, confirm primary user needs, and review capacity assumptions."},{id:"architecture",title:"Architecture outline",author:"Alex Example",status:"Approved",date:"Mar 11, 2027",body:"Example architecture outline: application boundary, capacity inputs, and integration considerations."}];
  let content:React.ReactNode;
  if(detail?.kind==="task"){
    const t=tasks.find(t=>t.id===detail.id)!;
    content=<section className="panel padded"><button className="back-link" onClick={()=>setDetail(null)}>← Back to {tab}</button><h2>{t.title}</h2><p className="helper">Document workspace · local draft only</p><label className="specialist-editor">Document content<textarea rows={16} value={t.body} placeholder="Write your example document here, or explore the AI tools." onChange={e=>setTasks(old=>old.map(row=>row.id===t.id?{...row,body:e.target.value,updated:new Date().toISOString()}:row))}/></label><p className="helper">Edits remain only in this open preview. No document is submitted or saved.</p></section>;
  }else if(detail?.kind==="delivery"){
    const d=deliveries.find(d=>d.id===detail.id)!;
    content=<><section className="panel padded"><div className="inline spread delivery-back-status"><button className="back-link" onClick={()=>setDetail(null)}>← Back to Deliverables</button><span className={d.status==="Pending review"?"status delivery-pending-review":"status neutral"}>{d.status}</span></div><h2>{d.title}</h2><p className="helper">{d.author} · {d.date} · Example · Read only</p><div className="specialist-document-preview"><h3>Document preview</h3>{d.id==="ux-brief" ? <><p className="helper">Demo document · illustrative content only</p>{DEMO_DOCUMENT_SECTIONS.map(section=><section key={section.title}><h3>{section.title}</h3><p>{section.body}</p></section>)}</> : <p>{d.body}</p>}</div></section><section className="panel padded specialist-comment-history"><h2>Comment history</h2><p className="muted">No comments yet.</p><label className="specialist-editor">Comment preview<textarea rows={3} placeholder="Write a comment" disabled /></label><p className="helper">Comments are not connected.</p></section></>;
  }else if(tab==="Overview")content=<section className="panel padded"><h2>My Tasks</h2>{taskTable()}</section>;
  else if(tab==="My Tasks")content=<SpecialistMyTasks p={taskProject} actorId={PEOPLE[0].id} personName={id=>PEOPLE.find(p=>p.id===id)?.name||id} onAddSelectedTasks={names=>addTasks([...names])} onOpenTask={id=>setDetail({kind:"task",id})}/>;
  else if(tab==="Deliverables")content=<section className="panel padded"><h2>Project Deliverables</h2><p className="helper">Team submissions · read only · example records</p><div className="table-wrap"><table><thead><tr><th>Deliverable</th><th>Created by</th><th>Submitted</th><th>Status</th><th>Action</th></tr></thead><tbody>{deliveries.map(d=><tr key={d.id}><td>{d.title}</td><td>{d.author}</td><td>{d.date}</td><td>{d.status}</td><td><button onClick={()=>setDetail({kind:"delivery",id:d.id})}>Open Delivery</button></td></tr>)}</tbody></table></div></section>;
  else if(tab==="Team")content=<SpecialistTeamPreview project={PROJECT} people={PEOPLE}/>;
  else if(tab==="Product Requirements")content=<><section className="panel padded"><div className="inline spread"><h2>Product Requirements</h2><span className="status neutral">Read only · example</span></div><h3>Capacity Planning · Version 1</h3><p className="muted">Source documents</p>{deliveries.map(d=><div className="inline spread" key={d.id}><span>{d.title}</span><span className="helper">{d.date}</span></div>)}</section><section className="panel padded"><h2>PRD Preview</h2><p className="helper">Fictional demo document · not an approved PRD · read only</p><div className="specialist-prd-document">{PRD_DEMO_SECTIONS.map(([title,body])=><section key={title}><h3>{title}</h3><p>{body}</p></section>)}</div></section></>;
  else content=<SpecialistActivity p={{...PROJECT,audit:[{id:"event-1",at:"2027-03-12T15:00:00Z",actorId:PEOPLE[2].id,action:"Discovery handoff submitted",details:{version:1,documentId:"ux-brief",note:"Illustrative submission"}},{id:"event-2",at:"2027-03-11T14:00:00Z",actorId:PEOPLE[1].id,action:"Architecture outline approved",details:{version:1,documentId:"architecture",note:"Illustrative review"}},{id:"event-3",at:"2027-01-05T09:00:00Z",actorId:PEOPLE[1].id,action:"Project created",details:{note:"Fictional project example"}}]}} personName={id=>PEOPLE.find(p=>p.id===id)?.name||id}/>;
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
              <small>Specialist</small>
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
              Specialist Home
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
                    <span className={tasks.length ? "status stakeholder-warning" : "status neutral specialist-no-attention"}>
                      {tasks.length} tasks need attention
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
                      setDetail(null);
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
    <SpecialistApp />
  </AssistantDraftProvider>,
);
