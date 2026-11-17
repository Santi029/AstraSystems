import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { ArrowLeft } from "lucide-react";
import {
  AssistantWorkspace,
  type AssistantContext,
} from "./AssistantWorkspace";
import "./admin-assistant-drawer.css";

/** Nonmodal: covers the tools rail, never the main work stage. No provider actions. */
export function AdminAssistantDrawer({
  rail,
  tool,
  context,
  onClose,
}: {
  rail: RefObject<HTMLElement | null>;
  tool: string;
  context: AssistantContext;
  onClose: () => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const [geometry, setGeometry] = useState({
    left: 0,
    top: 0,
    width: 0,
    desktop: false,
  });
  useLayoutEffect(() => {
    const element = rail.current;
    if (!element) return;
    const header = document.querySelector<HTMLElement>(".topbar");
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = {
        left: rect.left,
        top: Math.max(
          0,
          Math.min(
            window.innerHeight,
            header?.getBoundingClientRect().bottom ?? 0,
          ),
        ),
        width: rect.width,
        desktop: window.matchMedia("(min-width: 1151px)").matches,
      };
      setGeometry((previous) =>
        previous.left === next.left &&
        previous.top === next.top &&
        previous.width === next.width &&
        previous.desktop === next.desktop
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (header) observer.observe(header);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [rail]);
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLTextAreaElement>(".aw-composer textarea")
      ?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      // A native attachment/task/reference dialog owns its own Escape first.
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        !panel.current?.getClientRects().length ||
        !panel.current.contains(document.activeElement) ||
        panel.current.closest("[inert]") ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <section
      ref={panel}
      className="admin-assistant-drawer"
      data-layout={geometry.desktop ? "column" : "stacked"}
      role="dialog"
      aria-label="AI Assistant panel"
      aria-modal={false}
      style={
        {
          "--drawer-left": `${geometry.left}px`,
          "--drawer-top": `${geometry.top}px`,
          "--drawer-width": `${geometry.width}px`,
        } as CSSProperties
      }
    >
      <header className="admin-drawer-navigation">
        <button type="button" onClick={onClose} aria-label="Close AI Assistant">
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>
        <span>{tool}</span>
      </header>
      <div className="admin-drawer-content">
        <AssistantWorkspace context={context} compact />
      </div>
    </section>
  );
}
