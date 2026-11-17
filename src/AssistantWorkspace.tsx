import { AiGradientIcon } from "./AiGradientIcon";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowUp,
  AudioLines,
  Code2,
  Download,
  FileText,
  Image,
  Link2,
  Mic,
  Paperclip,
  Plus,
  Shapes,
  Trash2,
  X,
} from "lucide-react";
import {
  ASSISTANT_LIMITS,
  FILE_EXTENSIONS,
  appendAssistantAttachments,
  assistantContextKey,
  assistantDraftReducer,
  emptyAssistantDraft,
  fileAttachment,
  hasAssistantDraftContent,
  linkAttachment,
  serializeAssistantDraft,
  textAttachment,
  type AssistantAttachment,
  type AssistantContext,
  type AssistantDraft,
  type AssistantDraftAction,
  type AttachmentEntry,
  type AttachmentKind,
} from "./assistant-model";
import "./assistant.css";
export type { AssistantContext } from "./assistant-model";
export type AssistantTaskShortcut = {
  id: string;
  label: string;
  onOpen: () => void;
};
type DraftSession = {
  actorId: string | null;
  drafts: Record<string, AssistantDraft>;
  edit: (
    context: AssistantContext,
    update: (draft: AssistantDraft) => AssistantDraft,
  ) => void;
  clearAllDrafts: () => void;
  hasDrafts: boolean;
};
const DraftSessionContext = createContext<DraftSession | null>(null);
function AccountDraftSession({
  actorId,
  children,
}: {
  actorId: string | null;
  children: ReactNode;
}) {
  const [store, dispatch] = useReducer(assistantDraftReducer, {
    actorId,
    drafts: {},
  });
  const edit = useCallback(
    (
      context: AssistantContext,
      update: (draft: AssistantDraft) => AssistantDraft,
    ) =>
      dispatch({
        type: "edit",
        context,
        update,
      } satisfies AssistantDraftAction),
    [],
  );
  const clearAllDrafts = useCallback(() => dispatch({ type: "clear" }), []);
  const hasDrafts = Object.values(store.drafts).some(hasAssistantDraftContent);
  useEffect(() => {
    if (!hasDrafts) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasDrafts]);
  return (
    <DraftSessionContext.Provider
      value={{ ...store, edit, clearAllDrafts, hasDrafts }}
    >
      {children}
    </DraftSessionContext.Provider>
  );
}
/** Mount above App. Set actorId=null only after confirmed successful sign-out; changing actor discards old drafts. */
export function AssistantDraftProvider({
  actorId,
  children,
}: {
  actorId: string | null;
  children: ReactNode;
}) {
  return (
    <AccountDraftSession
      key={actorId === null ? "signed-out" : `actor:${actorId}`}
      actorId={actorId}
    >
      {children}
    </AccountDraftSession>
  );
}
/** Use hasDrafts to confirm sign-out. Clear only after confirmed discard or successful sign-out. */
export function useAssistantDraftSession(): Pick<
  DraftSession,
  "clearAllDrafts" | "hasDrafts"
> {
  const session = useContext(DraftSessionContext);
  if (!session)
    throw new Error(
      "AssistantWorkspace needs an AssistantDraftProvider above App.",
    );
  return {
    clearAllDrafts: session.clearAllDrafts,
    hasDrafts: session.hasDrafts,
  };
}
const options: {
  kind: AttachmentKind;
  label: string;
  description: string;
  Icon: typeof Link2;
}[] = [
  {
    kind: "link",
    label: "Link",
    description: "A web page or reference",
    Icon: Link2,
  },
  {
    kind: "document",
    label: "PDF, Word or Excel",
    description: "Document references",
    Icon: FileText,
  },
  {
    kind: "design",
    label: "Figma or design",
    description: "A link or design file",
    Icon: Shapes,
  },
  {
    kind: "code",
    label: "Code",
    description: "A snippet or source file",
    Icon: Code2,
  },
  {
    kind: "text",
    label: "Text",
    description: "Notes and pasted context",
    Icon: FileText,
  },
  {
    kind: "image",
    label: "Images",
    description: "Image file references",
    Icon: Image,
  },
  {
    kind: "audio",
    label: "Audio / recordings",
    description: "Existing audio files",
    Icon: AudioLines,
  },
];
const blankEntry: AttachmentEntry = { title: "", value: "" };
const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
function AttachmentCard({
  attachment,
  onRemove,
}: {
  attachment: AssistantAttachment;
  onRemove: () => void;
}) {
  const Icon =
    options.find((option) => option.kind === attachment.kind)?.Icon ||
    Paperclip;
  return (
    <li className="aw-reference">
      <div className="aw-reference-icon">
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="aw-reference-content">
        <strong>{attachment.title}</strong>
        <span className="aw-reference-meta">
          Not uploaded
          {attachment.file
            ? ` · ${sizeLabel(attachment.file.size)} · Metadata only`
            : " · Local text"}
        </span>
        {attachment.url && <p className="aw-reference-url">{attachment.url}</p>}
        {attachment.text && (
          <details>
            <summary>
              View {attachment.kind === "code" ? "code" : "text"}
            </summary>
            <pre>{attachment.text}</pre>
          </details>
        )}
      </div>
      <button
        className="aw-icon-button"
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${attachment.title}`}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </li>
  );
}
function AttachmentPicker({
  draft,
  onEditEntry,
  onAdd,
  onClose,
}: {
  draft: AssistantDraft;
  onEditEntry: (kind: AttachmentKind, entry: AttachmentEntry) => void;
  onAdd: (
    attachments: AssistantAttachment[],
    clearKind?: AttachmentKind,
  ) => boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    headingId = useId(),
    noteId = useId();
  const [kind, setKind] = useState<AttachmentKind | null>(null),
    [error, setError] = useState("");
  const firstField = useRef<HTMLInputElement>(null);
  const option = options.find((value) => value.kind === kind),
    entry = kind ? draft.entries[kind] || blankEntry : blankEntry;
  useEffect(() => {
    const returnFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);
  useEffect(() => {
    if (kind) firstField.current?.focus();
  }, [kind]);
  const setEntry = (update: Partial<AttachmentEntry>) => {
    if (kind) onEditEntry(kind, { ...entry, ...update });
  };
  const addFiles = (files: FileList | null) => {
    if (!kind || !files?.length) return;
    setError("");
    const additions: AssistantAttachment[] = [];
    for (const file of Array.from(files)) {
      const result = fileAttachment(crypto.randomUUID(), kind, file);
      if (!result.ok) {
        setError(`No files added. ${result.error}`);
        return;
      }
      additions.push(result.value);
    }
    const result = appendAssistantAttachments(draft, additions);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (onAdd(additions)) onClose();
  };
  const addEntry = () => {
    setError("");
    if (!kind) return;
    const result =
      kind === "link" || kind === "design"
        ? linkAttachment(crypto.randomUUID(), kind, entry)
        : kind === "text" || kind === "code"
          ? textAttachment(crypto.randomUUID(), kind, entry)
          : null;
    if (!result) return;
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const combined = appendAssistantAttachments(draft, [result.value]);
    if (!combined.ok) {
      setError(combined.error);
      return;
    }
    if (onAdd([result.value], kind)) onClose();
  };
  return (
    <dialog
      className="aw-dialog"
      ref={dialog}
      aria-labelledby={headingId}
      aria-describedby={noteId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="aw-dialog-heading">
        <h2 id={headingId}>{option ? `Add ${option.label}` : "Add context"}</h2>
        <button
          className="aw-icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close attachment picker"
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <p id={noteId} className="aw-muted">
        References stay in this local draft. Nothing is uploaded or opened.
      </p>
      {!kind ? (
        <div className="aw-option-grid">
          {options.map(({ kind: value, label, description, Icon }) => (
            <button
              type="button"
              key={value}
              className="aw-option"
              onClick={() => {
                setKind(value);
                setError("");
              }}
            >
              <Icon size={21} aria-hidden="true" />
              <span>
                <strong>{label}</strong>
                <small>{description}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {FILE_EXTENSIONS[kind] && (
            <div className="aw-file-select">
              <label>
                Choose files
                <input
                  ref={
                    kind === "document" || kind === "image" || kind === "audio"
                      ? firstField
                      : undefined
                  }
                  type="file"
                  multiple
                  accept={FILE_EXTENSIONS[kind]
                    ?.map((extension) => `.${extension}`)
                    .join(",")}
                  onChange={(event) => {
                    addFiles(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <p className="aw-muted">
                Only names, types and sizes are kept. File contents are not read
                or included in export.
              </p>
            </div>
          )}
          {["link", "design", "text", "code"].includes(kind) && (
            <form
              className="aw-entry-form"
              onSubmit={(event) => {
                event.preventDefault();
                addEntry();
              }}
            >
              {FILE_EXTENSIONS[kind] && (
                <p className="aw-form-divider">
                  Or{" "}
                  {kind === "design"
                    ? "add a design link"
                    : "paste a code snippet"}
                </p>
              )}
              <label>
                Reference title <span className="aw-muted">(optional)</span>
                <input
                  ref={firstField}
                  type="text"
                  value={entry.title}
                  maxLength={ASSISTANT_LIMITS.titleCharacters}
                  onChange={(event) => setEntry({ title: event.target.value })}
                />
              </label>
              {kind === "link" || kind === "design" ? (
                <label>
                  HTTPS link
                  <input
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    placeholder={
                      kind === "design"
                        ? "https://www.figma.com/design/…"
                        : "https://example.com/reference"
                    }
                    value={entry.value}
                    maxLength={ASSISTANT_LIMITS.urlCharacters}
                    onChange={(event) =>
                      setEntry({ value: event.target.value })
                    }
                  />
                  <small className="aw-muted">
                    Saved as a reference, never fetched or opened.
                  </small>
                </label>
              ) : (
                <label>
                  {kind === "code" ? "Code snippet" : "Text content"}
                  <textarea
                    rows={7}
                    spellCheck={kind !== "code"}
                    className={kind === "code" ? "aw-code-input" : undefined}
                    value={entry.value}
                    maxLength={ASSISTANT_LIMITS.textCharacters}
                    onChange={(event) =>
                      setEntry({ value: event.target.value })
                    }
                  />
                  <small className="aw-muted">
                    Treated as plain text. Nothing is executed.{" "}
                    {entry.value.length.toLocaleString()} / 20,000
                  </small>
                </label>
              )}
              <button type="submit" className="aw-primary">
                Add to draft
              </button>
            </form>
          )}
          <button
            type="button"
            className="aw-text-button"
            onClick={() => {
              setKind(null);
              setError("");
            }}
          >
            Back to options
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="aw-error">
          {error}
        </p>
      )}
      <div className="aw-dialog-footer">
        <small className="aw-muted">
          Technical preview limits: 10 references, 20 MB per file, 100 MB
          combined. Closing keeps your message and unfinished inputs.
        </small>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
function WorkspaceDraft({
  context,
  tasks,
  session,
  className = "",
  compact = false,
}: {
  context: AssistantContext;
  tasks: AssistantTaskShortcut[];
  session: DraftSession;
  className?: string;
  compact?: boolean;
}) {
  const key = assistantContextKey(context),
    draft = session.drafts[key] || emptyAssistantDraft(context);
  const [pickerOpen, setPickerOpen] = useState(false),
    [notice, setNotice] = useState("");
  const [exportError, setExportError] = useState("");
  const headingId = useId(),
    messageId = useId(),
    unavailableId = useId(),
    storageId = useId();
  const edit = (update: (value: AssistantDraft) => AssistantDraft) =>
    session.edit(context, update);
  const add = (
    attachments: AssistantAttachment[],
    clearKind?: AttachmentKind,
  ) => {
    const checked = appendAssistantAttachments(draft, attachments);
    if (!checked.ok) {
      setNotice(checked.error);
      return false;
    }
    edit((current) => {
      const result = appendAssistantAttachments(current, attachments);
      if (!result.ok) return current;
      const entries = { ...result.value.entries };
      if (clearKind) delete entries[clearKind];
      return { ...result.value, entries };
    });
    setNotice(
      `${attachments.length} ${attachments.length === 1 ? "reference added" : "references added"}. Not uploaded.`,
    );
    return true;
  };
  const exportDraft = () => {
    setExportError("");
    let url: string | undefined;
    try {
      const content = serializeAssistantDraft({
        ...draft,
        context: { ...context },
      });
      url = URL.createObjectURL(
        new Blob([content], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `astra-draft-${
        context.projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 48) || "project"
      }-${context.scopeId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 32)}.json`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      const downloadUrl = url;
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
      setNotice(
        "Local JSON download requested. It includes text and file details, not file contents.",
      );
    } catch {
      if (url) URL.revokeObjectURL(url);
      setExportError("The download could not start. Your draft is still here.");
    }
  };
  const pending = Object.values(draft.entries).some(
    (entry) => entry?.title || entry?.value,
  );
  return (
    <section
      className={`assistant-workspace ${compact ? "aw-admin-compact" : ""} ${className}`}
      aria-labelledby={headingId}
    >
      <header className="aw-header">
        <div className="aw-title">
          {!compact && (
            <span className="aw-assistant-mark" aria-hidden="true">
              <AiGradientIcon icon={Shapes} size={22} />
            </span>
          )}
          <div>
            <h2 id={headingId}>AI Assistant</h2>
            {!compact && <p>One workspace. Your context.</p>}
          </div>
        </div>
        <div className="aw-header-actions">
          <span className="aw-status">
            <span aria-hidden="true" />
            Not connected
          </span>
          <button
            type="button"
            onClick={exportDraft}
            disabled={!hasAssistantDraftContent(draft)}
            className="aw-export"
          >
            <Download size={16} aria-hidden="true" />
            Export draft
          </button>
        </div>
      </header>
      {!compact && (
        <div className="aw-context-bar">
          <strong>{context.projectName}</strong>
          <span>{context.roleLabel || "Role not assigned"}</span>
          <span>{context.scopeLabel}</span>
        </div>
      )}
      <div className="aw-body">
        {compact ? (
          <p id={unavailableId} className="aw-muted">
            AI and voice are not connected. Local draft only.
          </p>
        ) : (
          <div className="aw-intro">
            <span className="aw-eyebrow">YOUR WORKING CONTEXT</span>
            <h3>Prepare your next message</h3>
            <p>
              Bring your question, notes and references together for{" "}
              <strong>{context.scopeLabel}</strong>.
            </p>
            <p id={unavailableId} className="aw-muted">
              AI replies, sending and voice recording are unavailable. You can
              prepare and export a local draft.
            </p>
          </div>
        )}
        {tasks.length > 0 && (
          <nav className="aw-tasks" aria-label="Tasks in this context">
            {tasks.map((task) => (
              <button type="button" key={task.id} onClick={task.onOpen}>
                {task.label}
                <span aria-hidden="true">↗</span>
              </button>
            ))}
          </nav>
        )}
        {draft.attachments.length > 0 && (
          <section className="aw-references" aria-label="Draft references">
            <div className="aw-section-title">
              <h3>References</h3>
              <span>{draft.attachments.length} / 10</span>
            </div>
            <ul>
              {draft.attachments.map((attachment) => (
                <AttachmentCard
                  key={attachment.id}
                  attachment={attachment}
                  onRemove={() => {
                    edit((current) => ({
                      ...current,
                      attachments: current.attachments.filter(
                        (value) => value.id !== attachment.id,
                      ),
                    }));
                    setNotice(`Removed ${attachment.title} from this draft.`);
                  }}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
      <div className="aw-composer-area">
        <div className="aw-composer">
          <label htmlFor={messageId}>Message</label>
          <textarea
            id={messageId}
            aria-describedby={`${unavailableId} ${storageId}`}
            value={draft.message}
            maxLength={ASSISTANT_LIMITS.messageCharacters}
            rows={4}
            placeholder="Write a question or describe what you need help with…"
            onChange={(event) => {
              const message = event.target.value;
              edit((current) => ({ ...current, message }));
            }}
          />
          <div className="aw-composer-toolbar">
            <button
              type="button"
              className="aw-add"
              aria-label="Add context"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen(true)}
            >
              <Plus size={20} aria-hidden="true" />
              <span>Add context</span>
            </button>
            <small className="aw-character-count">
              {draft.message.length.toLocaleString()} / 12,000
            </small>
            <div className="aw-send-controls">
              <button
                type="button"
                className="aw-icon-button"
                disabled
                aria-label="Microphone unavailable"
                aria-describedby={unavailableId}
                title="Voice recording is not connected"
              >
                <Mic size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="aw-primary aw-send"
                disabled
                aria-describedby={unavailableId}
              >
                <ArrowUp size={18} aria-hidden="true" />
                Send to AI
              </button>
            </div>
          </div>
        </div>
        <div className="aw-draft-footer">
          <p id={storageId}>
            {compact
              ? "Export before reloading or signing out."
              : "Local draft · Kept while you navigate this signed-in session. Reloading or signing out clears it."}
          </p>
          <span>Not sent</span>
        </div>
        <p className="aw-export-note">
          {compact
            ? "Exports include text and references, not file contents."
            : "Export contains text, links and file metadata only. Selected binary files are not included."}
        </p>
        {pending && (
          <p className="aw-pending">
            Unfinished attachment input is kept. Open Add context to continue.
          </p>
        )}
        <p className="aw-feedback" role="status">
          {notice}
        </p>
        {exportError && (
          <p role="alert" className="aw-error">
            {exportError}
          </p>
        )}
      </div>
      {pickerOpen && (
        <AttachmentPicker
          draft={draft}
          onEditEntry={(kind, entry) =>
            edit((current) => ({
              ...current,
              entries: { ...current.entries, [kind]: entry },
            }))
          }
          onAdd={add}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}
/** Context/tasks are supplied by the authorized parent view. Labels do not grant access. */
export function AssistantWorkspace({
  context,
  tasks = [],
  className,
  compact = false,
}: {
  context: AssistantContext;
  tasks?: AssistantTaskShortcut[];
  className?: string;
  compact?: boolean;
}) {
  const session = useContext(DraftSessionContext);
  if (!session)
    throw new Error(
      "AssistantWorkspace needs an AssistantDraftProvider above App.",
    );
  if (!session.actorId || session.actorId !== context.actorId)
    return (
      <section className="assistant-workspace aw-access">
        <h2>AI Assistant</h2>
        <p>Sign in to the matching account to prepare a local draft.</p>
      </section>
    );
  return (
    <WorkspaceDraft
      key={assistantContextKey(context)}
      context={context}
      tasks={tasks}
      session={session}
      className={className}
      compact={compact}
    />
  );
}
