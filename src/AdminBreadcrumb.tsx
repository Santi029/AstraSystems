import { useEffect, useState } from "react";

type ExampleLocation = { screen: string; projectName: string; section: string };
const labels: Record<string, string> = {
  overview: "Overview",
  tasks: "My Tasks",
  reviews: "Deliverables",
  team: "Team",
  prd: "Product Requirements",
  audit: "Activity",
  settings: "Settings",
  review: "Deliverable",
};
export function AdminBreadcrumb({
  example,
  route,
  projectName,
  onProjects,
  onProject,
}: {
  example: boolean;
  route: string;
  projectName?: string;
  onProjects: () => void;
  onProject: () => void;
}) {
  const [location, setLocation] = useState<ExampleLocation>({
    screen: "dashboard",
    projectName: "",
    section: "overview",
  });
  useEffect(() => {
    const receive = (event: Event) =>
      setLocation((event as CustomEvent<ExampleLocation>).detail);
    window.addEventListener("astra-example-location", receive);
    const id = window.setTimeout(
      () => window.dispatchEvent(new Event("astra-example-location-request")),
      0,
    );
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("astra-example-location", receive);
    };
  }, [example]);
  const parts = route.split("/");
  const inProject = example
    ? ["project", "delivery"].includes(location.screen)
    : parts[0] === "project";
  const name = example ? location.projectName : projectName;
  const section = example
    ? location.screen === "delivery"
      ? "Deliverable"
      : labels[location.section]
    : labels[parts[2]] || "Overview";
  const destination = example
    ? location.screen === "logs"
      ? "Activity logs"
      : "Projects"
    : { settings: "Settings", logs: "Activity logs", create: "Create project" }[
        parts[0]
      ] || "Projects";
  const go = (target: "projects" | "project") => {
    if (example)
      window.dispatchEvent(
        new CustomEvent("astra-example-navigate", { detail: target }),
      );
    else (target === "projects" ? onProjects : onProject)();
  };
  return (
    <nav className="breadcrumb admin-breadcrumb" aria-label="Breadcrumb">
      <ol>
        <li>
          <button type="button" onClick={() => go("projects")}>
            Admin Home
          </button>
        </li>
        {inProject || destination !== "Projects" ? (
          <li>
            <span aria-hidden="true">›</span>
            <button type="button" onClick={() => go("projects")}>
              Projects
            </button>
          </li>
        ) : (
          <li>
            <span aria-hidden="true">›</span>
            <span aria-current="page">Projects</span>
          </li>
        )}
        {inProject ? (
          <>
            <li className="breadcrumb-project">
              <span aria-hidden="true">›</span>
              <button type="button" title={name} onClick={() => go("project")}>
                {name}
              </button>
            </li>
            <li>
              <span aria-hidden="true">›</span>
              <span aria-current="page">{section}</span>
            </li>
          </>
        ) : destination !== "Projects" ? (
          <li>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{destination}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
