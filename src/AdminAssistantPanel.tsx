import { AiGradientIcon } from "./AiGradientIcon";
import { useRef } from "react";
import {
  Presentation,
  MessageSquare,
  AudioLines,
  FileText,
  Table2,
  Search,
} from "lucide-react";
import {
  AssistantWorkspace,
  type AssistantContext,
} from "./AssistantWorkspace";
/** Exact six-option Figma toolbox. Availability never implies a provider connection. */
export function AdminAgentToolbox({
  onFocusChat,
  onOpenTool,
}: {
  onFocusChat: () => void;
  onOpenTool?: (tool: string) => void;
}) {
  const tools = [
    { label: "Whiteboard", Icon: Presentation },
    { label: "Chat", Icon: MessageSquare },
    { label: "Talk to Your Agent", Icon: AudioLines },
    { label: "Word", Icon: FileText },
    { label: "Excel", Icon: Table2 },
    { label: "Research", Icon: Search },
  ];
  return (
    <section className="admin-toolbox" aria-label="AI Agent Toolbox">
      <h2>
        <AiGradientIcon /> AI Agent Toolbox
      </h2>
      <div className="admin-toolbox-grid">
        {tools.map(({ label, Icon }) => (
          <button
            key={label}
            type="button"
            className={
              onOpenTool && label !== "Chat"
                ? "admin-tool-unconnected"
                : undefined
            }
            disabled={!onOpenTool && label !== "Chat"}
            title={
              onOpenTool
                ? "Open local draft · Tool not connected"
                : label === "Chat"
                  ? "Focus the local conversation draft"
                  : "Not connected"
            }
            onClick={() => (onOpenTool ? onOpenTool(label) : onFocusChat())}
          >
            <AiGradientIcon icon={Icon} size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <p>Tools are not connected. Chat focuses your local draft.</p>
    </section>
  );
}
export function AdminAssistantPanel({
  context,
}: {
  context: AssistantContext;
}) {
  const panel = useRef<HTMLDivElement>(null);
  return (
    <div ref={panel} className="admin-ai-panel">
      <AssistantWorkspace context={context} compact />
      <AdminAgentToolbox
        onFocusChat={() =>
          panel.current
            ?.querySelector<HTMLTextAreaElement>(".aw-composer textarea")
            ?.focus()
        }
      />
    </div>
  );
}
