export type DashboardProject = {
  id: string;
  name: string;
  description?: string;
  startDate?: unknown;
  endDate?: unknown;
  isAdmin?: boolean;
  team?: { personId: string; roles: string[] }[];
  prd?: {
    status?: string;
    readiness?: { approved?: unknown; total?: unknown };
  };
  summary?: { needsReview?: unknown };
  questionnaire?: { assignedTo?: string; status?: string } | null;
};
export function recordedDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const date = new Date(value + "T00:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
export function sourceReadiness(project: DashboardProject): string {
  const { approved, total } = project.prd?.readiness || {};
  if (
    typeof approved !== "number" ||
    typeof total !== "number" ||
    !Number.isInteger(approved) ||
    !Number.isInteger(total) ||
    approved < 0 ||
    total < 0 ||
    approved > total
  )
    return "Not recorded";
  return total === 0
    ? "Required sources not selected"
    : `${approved} of ${total} required sources approved`;
}
export function recordedPrdStatus(project: DashboardProject): string {
  const labels: Record<string, string> = {
    not_started: "Not started",
    draft: "Draft",
    prepared: "Prepared for review",
    closed: "PRD closed",
    needs_refresh: "Sources changed",
  };
  const status = project.prd?.status || "";
  return Object.hasOwn(labels, status) ? labels[status] : "Not recorded";
}
/** Display/routing only. Project data and mutation authority remain server-owned. */
export function hasStakeholderContext(
  project: DashboardProject,
  actorId: string,
): boolean {
  return (
    project.questionnaire?.assignedTo === actorId ||
    project.team?.some(
      (member) =>
        member.personId === actorId && member.roles.includes("Stakeholder"),
    ) === true
  );
}
export function reviewCount(project: DashboardProject): number | null {
  const value = project.summary?.needsReview;
  return project.isAdmin === true &&
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0
    ? value
    : null;
}
