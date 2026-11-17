import type { DashboardProject } from "./dashboard-model";

export type DashboardPerson = {
  id: string;
  name?: string;
  accountStatus?: string;
};

/** Optional display facts, not a calculation or a write contract. The current
 * real DTO does not record global progress or stages. Examples must supply
 * their own explicitly fictional values rather than fill missing real data. */
export type AdminDashboardProject = DashboardProject & {
  adminIds?: readonly string[];
  projectStatus?: unknown;
  projectVersion?: unknown;
  projectProgressPercent?: unknown;
  projectStages?: readonly {
    id?: string;
    name: string;
    status?: string;
  }[];
};

export type DashboardTeamMember = {
  id: string;
  name: string | null;
  initials: string | null;
  roles: string[];
  accountStatus: string | null;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Assigned people, not a count of active or verified accounts. No directory
 * member is included unless the project explicitly references their ID. */
export function dashboardTeam(
  project: AdminDashboardProject,
  people: readonly DashboardPerson[] = [],
): DashboardTeamMember[] {
  const assigned = new Map<string, Set<string>>();
  const add = (id: unknown, roles: unknown) => {
    if (typeof id !== "string" || !id.trim()) return;
    const current = assigned.get(id) || new Set<string>();
    if (Array.isArray(roles))
      for (const role of roles) {
        const label = text(role);
        if (label) current.add(label);
      }
    assigned.set(id, current);
  };
  if (Array.isArray(project.team))
    for (const member of project.team)
      if (member && typeof member === "object")
        add(member.personId, member.roles);
  if (Array.isArray(project.adminIds))
    for (const id of project.adminIds) add(id, ["Admin"]);

  const directory = new Map<string, DashboardPerson>();
  if (Array.isArray(people))
    for (const person of people)
      if (
        person &&
        typeof person.id === "string" &&
        (!directory.has(person.id) ||
          (!text(directory.get(person.id)?.name) && text(person.name)))
      )
        directory.set(person.id, person);

  return [...assigned].map(([id, roles]) => {
    const person = directory.get(id);
    const name = text(person?.name);
    const words = name?.split(/\s+/) || [];
    const initials = words.length
      ? [words[0], ...(words.length > 1 ? [words.at(-1)!] : [])]
          .map((word) => Array.from(word)[0])
          .join("")
          .toLocaleUpperCase()
      : null;
    return {
      id,
      name,
      initials,
      roles: [...roles],
      accountStatus: text(person?.accountStatus),
    };
  });
}

export function recordedProjectProgress(project: unknown): number | null {
  const value =
    project &&
    typeof project === "object" &&
    Object.hasOwn(project, "projectProgressPercent")
      ? (project as AdminDashboardProject).projectProgressPercent
      : undefined;
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
    ? value
    : null;
}

export type DashboardStage = {
  name: string;
  status: string;
  tone: "neutral" | "info" | "success" | "warning" | "error";
};

/** Only explicit ordered stages with a nonempty name are displayed. No stage
 * names, order, completion or current stage are inferred from other facts. */
export function recordedProjectStages(project: unknown): DashboardStage[] {
  const stages =
    project &&
    typeof project === "object" &&
    Object.hasOwn(project, "projectStages")
      ? (project as AdminDashboardProject).projectStages
      : undefined;
  if (!Array.isArray(stages)) return [];
  const labels: Record<string, Omit<DashboardStage, "name">> = {
    not_started: { status: "Not started", tone: "neutral" },
    in_progress: { status: "In progress", tone: "info" },
    complete: { status: "Complete", tone: "success" },
    closed: { status: "Closed", tone: "success" },
    blocked: { status: "Blocked", tone: "warning" },
    missing_info: { status: "Missing information", tone: "warning" },
    stopped: { status: "Stopped", tone: "error" },
  };
  return stages.flatMap((stage) => {
    if (!stage || typeof stage !== "object") return [];
    const name = text(stage.name);
    if (!name) return [];
    const status =
      typeof stage.status === "string" && Object.hasOwn(labels, stage.status)
        ? labels[stage.status]
        : { status: "Not recorded", tone: "neutral" as const };
    return [{ name, ...status }];
  });
}
