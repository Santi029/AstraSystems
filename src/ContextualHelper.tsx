import { roleDisplayLabel } from "./role-display";
import type { ReactNode } from "react";
type HelperAction = { label: string; onClick: () => void };
type HelperProps = {
  projectName: string;
  roleLabel: string;
  contextLabel: string;
  contextText?: string;
  details?: string[];
  actions?: HelperAction[];
};
/** Display only. This label never grants or changes permissions. */
export function profileRoleLabel(
  actor: { globalRoles?: unknown } | null | undefined,
): string {
  const roles = Array.isArray(actor?.globalRoles)
    ? actor.globalRoles.filter(
        (role): role is string =>
          typeof role === "string" && role.trim().length > 0,
      )
    : [];
  return [...new Set(roles)].map(roleDisplayLabel).join(" · ") || "Role not assigned";
}
/** Provider-unavailable surface. No requests, microphone, storage or mutations. */
export function ContextualHelper({
  projectName,
  roleLabel,
  contextLabel,
  contextText,
  details = [],
  actions = [],
}: HelperProps): ReactNode {
  return (
    <section className="panel padded contextual-helper" aria-label="AI Helper">
      <div className="inline spread">
        <h2>AI Helper</h2>
        <span className="status neutral">Not connected</span>
      </div>
      <p className="helper-context-label">{contextLabel}</p>
      <div className="helper-context">
        <strong>{projectName}</strong>
        <span>{roleLabel}</span>
      </div>
      {contextText && <p className="helper-context-text">{contextText}</p>}
      {details.length > 0 && (
        <ul className="helper-context-details">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      <p className="helper" role="note">
        AI and conversational voice are not connected. No messages are sent, no
        microphone is active, and this helper cannot change or submit your work.
      </p>
      <label>
        Message to AI Helper
        <textarea disabled rows={3} placeholder="Available after AI setup" />
      </label>
      <div className="actions">
        <button disabled type="button">
          Voice unavailable
        </button>
        <button disabled type="button" className="primary">
          Send to assistant
        </button>
      </div>
      {actions.length > 0 && (
        <div className="helper-context-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="text-button"
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
