export type AdminCardStatus = {
  label: string;
  tone: "info" | "success" | "warning" | "error" | "neutral";
  recorded: boolean;
};

/** The current server DTO has no project lifecycle status. Only an explicit
 * projectStatus field may populate this display contract. PRD approval, tasks,
 * review counts, dates and missing information never imply a project status. */
export function adminCardProjectStatus(project: unknown): AdminCardStatus {
  const value =
    project &&
    typeof project === "object" &&
    Object.hasOwn(project, "projectStatus")
      ? (project as { projectStatus?: unknown }).projectStatus
      : undefined;
  switch (value) {
    case "starting":
      return { label: "Starting", tone: "info", recorded: true };
    case "in_progress":
      return { label: "In progress", tone: "info", recorded: true };
    case "complete":
      return { label: "Complete", tone: "success", recorded: true };
    case "blocked":
      return { label: "Blocked", tone: "warning", recorded: true };
    case "missing_info":
      return { label: "Missing information", tone: "warning", recorded: true };
    case "stopped":
      return { label: "Stopped", tone: "error", recorded: true };
    default:
      return { label: "Not recorded", tone: "neutral", recorded: false };
  }
}
