import { useCallback, useRef, useState } from "react";
import { recordedProjectProgress } from "./admin-dashboard-model";
import { adminCardProjectStatus } from "./admin-card-status";
import { recordedDate } from "./dashboard-model";
import { AdminMyTasks } from "./AdminMyTasks";
import { AdminAssistantDrawer } from "./AdminAssistantDrawer";
import { AdminAgentToolbox } from "./AdminAssistantPanel";
import { AdminReferenceDocuments } from "./AdminReferenceDocuments";
import { AdminDeliverables } from "./AdminDeliverables";
import type { AdminSourceRecord, PersonName } from "./admin-view-model";
import "./admin-overview.css";

type Props = {
  p: Record<string, any>;
  actorId: string;
  personName: PersonName;
  onOpenDelivery: (delivery: AdminSourceRecord) => void | Promise<unknown>;
  onViewAll: () => void;
  busy?: boolean;
  draftScopeId?: string;
};
/** Explicit project facts only: PRD approvals and task counts never imply progress. */
export function AdminProjectProgress({ p }: { p: Record<string, any> }) {
  const progress = recordedProjectProgress(p);
  const status = adminCardProjectStatus(p);
  const version =
    typeof p.projectVersion === "string"
      ? p.projectVersion.trim()
      : typeof p.projectVersion === "number" &&
          Number.isFinite(p.projectVersion)
        ? String(p.projectVersion)
        : "";
  return (
    <section
      className={`admin-overview-project-progress admin-overview-progress-${status.tone}`}
      aria-label="Project progress"
    >
      <div className="admin-overview-progress-heading">
        <h2>Project progress</h2>
        <strong className={progress === null ? "is-unrecorded" : undefined}>
          {progress === null ? "Not recorded" : `${progress}%`}
        </strong>
      </div>
      <dl className="admin-overview-project-dates">
        {version && (
          <div>
            <dt>Version</dt>
            <dd>{version}</dd>
          </div>
        )}
        <div>
          <dt>Start</dt>
          <dd>{recordedDate(p.startDate) || "Not recorded"}</dd>
        </div>
        <div>
          <dt>Tentative end</dt>
          <dd>{recordedDate(p.endDate) || "Not recorded"}</dd>
        </div>
      </dl>
    </section>
  );
}

/** Admin-only composition confirmed by the owner; preserves the same project draft namespace. */
export function AdminOverview({
  p,
  actorId,
  personName,
  onOpenDelivery,
  onViewAll,
  busy = false,
  draftScopeId = "project",
}: Props) {
  return (
    <div className="admin-overview-layout">
      <div className="admin-overview-center">
        <AdminMyTasks p={p} actorId={actorId} personName={personName} summary />
        <AdminDeliverables
          p={p}
          personName={personName}
          onOpenDelivery={onOpenDelivery}
          busy={busy}
          recentLimit={5}
          pendingOnly
          onViewAll={onViewAll}
        />
      </div>
      <AdminProjectToolsRail
        p={p}
        actorId={actorId}
        personName={personName}
        draftScopeId={draftScopeId}
      />
    </div>
  );
}

/** The approved Overview rail reused unchanged across the five Admin project views. */
export function AdminProjectToolsRail({
  p,
  actorId,
  personName,
  draftScopeId = "project",
  scopeLabel = "Overview",
}: Pick<Props, "p" | "actorId" | "personName" | "draftScopeId"> & {
  scopeLabel?: string;
}) {
  const rail = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const [tool, setTool] = useState<string | null>(null);
  const openTool = useCallback((label: string) => {
    returnFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setTool(label);
  }, []);
  const closeTool = useCallback(() => {
    setTool(null);
    requestAnimationFrame(() => {
      const target = returnFocus.current;
      if (target?.isConnected && !target.closest("[inert]")) target.focus();
    });
  }, []);
  return (
    <aside
      ref={rail}
      className={"admin-overview-rail" + (tool ? " has-chat-drawer" : "")}
      aria-label="Project tools and approved references"
    >
      <div className="admin-overview-rail-content" inert={tool !== null}>
        <AdminAgentToolbox
          onFocusChat={() => openTool("Chat")}
          onOpenTool={openTool}
        />
        <AdminReferenceDocuments p={p} personName={personName} />
      </div>
      {tool !== null && (
        <AdminAssistantDrawer
          rail={rail}
          tool={tool}
          onClose={closeTool}
          context={{
            actorId,
            projectId: p.id,
            projectName: p.name,
            roleLabel: "Admin",
            scopeId: draftScopeId,
            scopeLabel,
          }}
        />
      )}
    </aside>
  );
}
