import { useEffect, useState } from "react";
/** Local visual navigation preference. Does not mutate projects or accounts. */
export function SidebarCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const shell = document.querySelector(".app-shell");
    shell?.classList.toggle("sidebar-is-collapsed", collapsed);
    document
      .querySelectorAll<HTMLButtonElement>(
        ".sidebar nav button, .sidebar .profile",
      )
      .forEach((button) => {
        const label = button.textContent?.trim() || "Navigation";
        button.setAttribute("aria-label", label);
        button.title = label;
      });
    return () => shell?.classList.remove("sidebar-is-collapsed");
  }, [collapsed]);
  return (
    <button
      type="button"
      className="sidebar-collapse-control"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-expanded={!collapsed}
      aria-controls="primary-sidebar"
      onClick={() => {
        setCollapsed((value) => !value);
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        document
          .querySelectorAll<SVGElement>(
            ".sidebar .logo-orbit, .sidebar .logo-heart",
          )
          .forEach((part) => {
            part.getAnimations().forEach((animation) => animation.cancel());
            if (reduced) return;
            const orbit = part.classList.contains("logo-orbit");
            part.animate(
              orbit
                ? [
                    { transform: "rotate(0deg)" },
                    { transform: "rotate(18deg)", offset: 0.5 },
                    { transform: "rotate(0deg)" },
                  ]
                : [
                    { opacity: 1 },
                    { opacity: 0.72, offset: 0.22 },
                    { opacity: 1, offset: 0.4 },
                    { opacity: 0.82, offset: 0.58 },
                    { opacity: 1 },
                  ],
              { duration: 1800, easing: "ease-in-out", iterations: 1 },
            );
          });
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d={collapsed ? "m9 5 7 7-7 7" : "m15 5-7 7 7 7"} />
      </svg>
    </button>
  );
}
