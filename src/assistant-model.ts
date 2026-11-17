/** Local, non-authoritative assistant draft data. No transport or browser storage. */
export type AssistantContext = {
  actorId: string;
  projectId: string;
  projectName: string;
  roleLabel: string;
  scopeId: string;
  scopeLabel: string;
};
export type AttachmentKind =
  | "link"
  | "document"
  | "design"
  | "code"
  | "text"
  | "image"
  | "audio";
export type FileMetadata = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
};
export type AssistantAttachment = {
  id: string;
  kind: AttachmentKind;
  title: string;
  status: "not-uploaded";
  url?: string;
  text?: string;
  file?: FileMetadata;
};
export type AttachmentEntry = { title: string; value: string };
export type AssistantDraft = {
  context: AssistantContext;
  message: string;
  attachments: AssistantAttachment[];
  entries: Partial<Record<AttachmentKind, AttachmentEntry>>;
};
export const ASSISTANT_LIMITS = Object.freeze({
  messageCharacters: 12_000,
  textCharacters: 20_000,
  urlCharacters: 2_048,
  titleCharacters: 160,
  attachments: 10,
  fileBytes: 20 * 1024 * 1024,
  totalFileBytes: 100 * 1024 * 1024,
});
export const FILE_EXTENSIONS: Partial<
  Record<AttachmentKind, readonly string[]>
> = {
  document: ["pdf", "doc", "docx", "xls", "xlsx", "csv", "odt", "ods"],
  design: ["fig", "sketch", "pdf", "svg", "png", "jpg", "jpeg", "webp"],
  code: [
    "js",
    "jsx",
    "ts",
    "tsx",
    "json",
    "py",
    "css",
    "html",
    "sql",
    "sh",
    "yaml",
    "yml",
    "md",
    "txt",
    "java",
    "go",
    "rs",
    "rb",
    "php",
    "swift",
    "kt",
    "c",
    "cpp",
    "h",
  ],
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg"],
  audio: ["mp3", "m4a", "wav", "ogg", "webm", "aac", "flac"],
};
export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
const failure = (error: string): { ok: false; error: string } => ({
  ok: false,
  error,
});
export function assistantContextKey(context: AssistantContext): string {
  if (
    ![context.actorId, context.projectId, context.scopeId].every(
      (value) => typeof value === "string" && value.trim(),
    )
  )
    throw new Error("An assistant draft needs an actor, project and scope.");
  return JSON.stringify([context.actorId, context.projectId, context.scopeId]);
}
export function emptyAssistantDraft(context: AssistantContext): AssistantDraft {
  assistantContextKey(context);
  return { context: { ...context }, message: "", attachments: [], entries: {} };
}
export function validateAssistantUrl(value: string): Validation<string> {
  const input = value.trim();
  if (
    !input ||
    input.length > ASSISTANT_LIMITS.urlCharacters ||
    /[\u0000-\u0020\u007f]/.test(input)
  )
    return failure(
      "Enter an HTTPS link with no spaces, up to 2,048 characters.",
    );
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return failure(
        "Use an HTTPS link without a username or password in the URL.",
      );
    return { ok: true, value: url.href };
  } catch {
    return failure(
      "Enter a complete HTTPS link, such as https://example.com/design.",
    );
  }
}
export function linkAttachment(
  id: string,
  kind: "link" | "design",
  entry: AttachmentEntry,
): Validation<AssistantAttachment> {
  const url = validateAssistantUrl(entry.value);
  if (!url.ok) return url;
  if (entry.title.length > ASSISTANT_LIMITS.titleCharacters)
    return failure("Keep the title within 160 characters.");
  return {
    ok: true,
    value: {
      id,
      kind,
      title: entry.title.trim() || (kind === "design" ? "Design link" : "Link"),
      url: url.value,
      status: "not-uploaded",
    },
  };
}
export function textAttachment(
  id: string,
  kind: "text" | "code",
  entry: AttachmentEntry,
): Validation<AssistantAttachment> {
  if (!entry.value.trim())
    return failure(
      kind === "code" ? "Paste some code first." : "Add some text first.",
    );
  if (entry.value.length > ASSISTANT_LIMITS.textCharacters)
    return failure(
      "Keep each text or code reference within 20,000 characters.",
    );
  if (entry.title.length > ASSISTANT_LIMITS.titleCharacters)
    return failure("Keep the title within 160 characters.");
  return {
    ok: true,
    value: {
      id,
      kind,
      title:
        entry.title.trim() || (kind === "code" ? "Code snippet" : "Text note"),
      text: entry.value,
      status: "not-uploaded",
    },
  };
}
export function fileAttachment(
  id: string,
  kind: AttachmentKind,
  file: FileMetadata,
): Validation<AssistantAttachment> {
  const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
  if (!FILE_EXTENSIONS[kind]?.includes(extension))
    return failure(
      `“${file.name}” is not a supported file type for this option.`,
    );
  if (!Number.isSafeInteger(file.size) || file.size <= 0)
    return failure(`“${file.name}” is empty or has an invalid size.`);
  if (file.size > ASSISTANT_LIMITS.fileBytes)
    return failure(
      `“${file.name}” exceeds the technical preview limit of 20 MB per file.`,
    );
  // Metadata only: do not keep File handles, read content, generate previews or execute anything.
  return {
    ok: true,
    value: {
      id,
      kind,
      title: file.name,
      status: "not-uploaded",
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      },
    },
  };
}
export function appendAssistantAttachments(
  draft: AssistantDraft,
  additions: AssistantAttachment[],
): Validation<AssistantDraft> {
  if (
    draft.attachments.length + additions.length >
    ASSISTANT_LIMITS.attachments
  )
    return failure(
      "This technical preview supports up to 10 references per draft. Nothing was added.",
    );
  const all = [...draft.attachments, ...additions];
  if (
    all.reduce((sum, attachment) => sum + (attachment.file?.size || 0), 0) >
    ASSISTANT_LIMITS.totalFileBytes
  )
    return failure(
      "Selected files exceed the technical preview limit of 100 MB combined. Nothing was added.",
    );
  if (new Set(all.map((attachment) => attachment.id)).size !== all.length)
    return failure("That reference is already in this draft.");
  return { ok: true, value: { ...draft, attachments: all } };
}
export function hasAssistantDraftContent(draft: AssistantDraft): boolean {
  return !!(
    draft.message ||
    draft.attachments.length ||
    Object.values(draft.entries).some((entry) => entry?.title || entry?.value)
  );
}
export type AssistantDraftStore = {
  actorId: string | null;
  drafts: Record<string, AssistantDraft>;
};
export type AssistantDraftAction =
  | { type: "actor"; actorId: string | null }
  | { type: "clear" }
  | {
      type: "edit";
      context: AssistantContext;
      update: (draft: AssistantDraft) => AssistantDraft;
    };
export function assistantDraftReducer(
  state: AssistantDraftStore,
  action: AssistantDraftAction,
): AssistantDraftStore {
  if (action.type === "actor")
    return action.actorId === state.actorId
      ? state
      : { actorId: action.actorId, drafts: {} };
  if (action.type === "clear") return { actorId: state.actorId, drafts: {} };
  if (!state.actorId || state.actorId !== action.context.actorId)
    throw new Error("Draft context does not belong to the signed-in account.");
  const key = assistantContextKey(action.context);
  const draft = action.update(
    state.drafts[key] || emptyAssistantDraft(action.context),
  );
  if (draft.message.length > ASSISTANT_LIMITS.messageCharacters)
    throw new Error("Message exceeds the 12,000-character preview limit.");
  return {
    ...state,
    drafts: {
      ...state.drafts,
      [key]: { ...draft, context: { ...action.context } },
    },
  };
}
export function serializeAssistantDraft(
  draft: AssistantDraft,
  exportedAt = new Date().toISOString(),
): string {
  return (
    JSON.stringify(
      {
        format: "astra-local-assistant-draft",
        version: 1,
        exportedAt,
        notice:
          "Local draft only. Nothing has been sent to AI or uploaded. Selected file binaries are NOT included; file entries contain metadata only. Links and code are inert text. Unfinished attachment inputs are included separately.",
        context: draft.context,
        message: draft.message,
        attachments: draft.attachments,
        unfinishedAttachmentInputs: draft.entries,
        binaryContentsIncluded: false,
        uploaded: false,
      },
      null,
      2,
    ) + "\n"
  );
}
