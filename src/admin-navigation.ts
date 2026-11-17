/** Admin presentation only. Never grants server authority or changes saved work. */
export const ADMIN_SECTIONS = [
  "overview",
  "tasks",
  "reviews",
  "team",
  "prd",
  "audit",
  "settings",
] as const;
export const ADMIN_SECTION_LABELS: Record<string, string> = {
  overview: "Overview",
  tasks: "My Tasks",
  reviews: "Deliverables",
  team: "Team",
  prd: "Product Requirements",
  audit: "Activity",
  settings: "Settings",
};
export function resolveAdminSection(section: string): string {
  if (section === "documents") return "reviews";
  if (
    ["assistant", "work", "external", "questionnaire", "wireframe"].includes(
      section,
    )
  )
    return "overview";
  return section;
}
