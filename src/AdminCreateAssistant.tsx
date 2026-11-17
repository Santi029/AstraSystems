import { AdminAssistantPanel } from "./AdminAssistantPanel";
import "./admin-create.css";

/** Local setup notes only: no project exists yet, and no real project context is reused. */
export function AdminCreateAssistant({ actorId }: { actorId: string }) {
  return (
    <section
      className="admin-create-assistant"
      aria-label="Project setup assistant"
    >
      <AdminAssistantPanel
        context={{
          actorId,
          projectId: "__new-project-setup__",
          projectName: "New project setup",
          roleLabel: "Admin",
          scopeId: "create-project",
          scopeLabel: "Project setup",
        }}
      />
    </section>
  );
}
