/** Manual, tab-memory wireframes. This module never calls AI, storage or a URL. */
export const WIREFRAME_LIMITS = Object.freeze({
  screens: 12,
  sectionsPerScreen: 12,
  elementsPerSection: 24,
  totalElements: 160,
  sources: 24,
  shortText: 160,
  elementText: 4000,
  notes: 8000,
  url: 2048,
  bytes: 512 * 1024,
});
export const WIREFRAME_ELEMENT_KINDS = [
  "text",
  "input",
  "button",
  "link",
] as const;
export type WireframeElementKind = (typeof WIREFRAME_ELEMENT_KINDS)[number];
export type WireframeDestination =
  | { kind: "none" }
  | { kind: "screen"; screenId: string }
  | { kind: "reference"; url: string };
export type WireframeSource = {
  id: string;
  kind: "note" | "link";
  label: string;
  value: string;
};
export type WireframeElement = {
  id: string;
  kind: WireframeElementKind;
  label: string;
  sourceIds: string[];
  destination: WireframeDestination;
};
export type WireframeSection = {
  id: string;
  title: string;
  elements: WireframeElement[];
};
export type WireframeScreen = {
  id: string;
  title: string;
  sections: WireframeSection[];
};
export type WireframeDraft = {
  schemaVersion: 1;
  projectId: string;
  title: string;
  intent: string;
  sources: WireframeSource[];
  screens: WireframeScreen[];
  selectedScreenId: string | null;
  questions: string;
  assumptions: string;
  feedback: string;
  uxNotes: string;
};
export type WireframeIssue = { id: string; message: string };
export type WireframeExport = {
  format: "astra.quick-wireframe";
  version: 1;
  mode: "manual";
  sharedSaved: false;
  aiGenerated: false;
  exportedAt: string;
  draft: WireframeDraft;
  pending: WireframeIssue[];
};

const plain = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === "object" &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null);
const fail = (message: string): never => {
  throw new Error(message);
};
const text = (value: unknown, max: number, name: string): string => {
  if (typeof value !== "string" || value.length > max || /\u0000/.test(value))
    fail(`${name} exceeds its limit or is invalid.`);
  return value as string;
};
const keys = (value: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    fail("The draft contains unsupported fields.");
};
const array = (value: unknown, max: number, name: string): unknown[] => {
  if (!Array.isArray(value) || value.length > max)
    fail(`${name} exceeds its limit or is invalid.`);
  return value as unknown[];
};
const object = (value: unknown): Record<string, unknown> =>
  plain(value) ? value : fail("The draft contains an invalid object.");
const validId = (value: unknown): string => {
  const id = text(value, 100, "Identifier");
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(id))
    fail("The draft contains an invalid identifier.");
  return id;
};
export const newWireframeId = () => `wf_${crypto.randomUUID()}`;
export function createWireframeDraft(projectId: string): WireframeDraft {
  validId(projectId);
  return {
    schemaVersion: 1,
    projectId,
    title: "",
    intent: "",
    sources: [],
    screens: [],
    selectedScreenId: null,
    questions: "",
    assumptions: "",
    feedback: "",
    uxNotes: "",
  };
}
export const createWireframeScreen = (
  id = newWireframeId(),
): WireframeScreen => ({ id, title: "", sections: [] });
export const createWireframeSection = (
  id = newWireframeId(),
): WireframeSection => ({ id, title: "", elements: [] });
export const createWireframeElement = (
  id = newWireframeId(),
): WireframeElement => ({
  id,
  kind: "text",
  label: "",
  sourceIds: [],
  destination: { kind: "none" },
});
export const createWireframeSource = (
  id = newWireframeId(),
): WireframeSource => ({ id, kind: "note", label: "", value: "" });

/** Structural validation preserves unfinished user input. Invalid URLs remain
 * inert text with an issue; they are never executable destinations. */
export function validateWireframeDraft(
  value: unknown,
  projectId?: string,
): WireframeDraft {
  const d = object(value);
  keys(d, [
    "schemaVersion",
    "projectId",
    "title",
    "intent",
    "sources",
    "screens",
    "selectedScreenId",
    "questions",
    "assumptions",
    "feedback",
    "uxNotes",
  ]);
  if (d.schemaVersion !== 1) fail("Unsupported wireframe draft version.");
  const scope = validId(d.projectId);
  if (projectId !== undefined && scope !== projectId)
    fail("This draft belongs to another project.");
  const seen = new Set<string>();
  const id = (value: unknown) => {
    const result = validId(value);
    if (seen.has(result)) fail("Draft identifiers must be unique.");
    seen.add(result);
    return result;
  };
  const sources: WireframeSource[] = array(
    d.sources,
    WIREFRAME_LIMITS.sources,
    "Sources",
  ).map((value) => {
    const s = object(value);
    keys(s, ["id", "kind", "label", "value"]);
    if (s.kind !== "note" && s.kind !== "link") fail("Unknown source type.");
    return {
      id: id(s.id),
      kind: s.kind as WireframeSource["kind"],
      label: text(s.label, WIREFRAME_LIMITS.shortText, "Source label"),
      value: text(
        s.value,
        s.kind === "link" ? WIREFRAME_LIMITS.url : WIREFRAME_LIMITS.notes,
        "Source",
      ),
    };
  });
  let total = 0;
  const screens: WireframeScreen[] = array(
    d.screens,
    WIREFRAME_LIMITS.screens,
    "Screens",
  ).map((value) => {
    const s = object(value);
    keys(s, ["id", "title", "sections"]);
    return {
      id: id(s.id),
      title: text(s.title, WIREFRAME_LIMITS.shortText, "Screen name"),
      sections: array(
        s.sections,
        WIREFRAME_LIMITS.sectionsPerScreen,
        "Sections",
      ).map((value) => {
        const section = object(value);
        keys(section, ["id", "title", "elements"]);
        return {
          id: id(section.id),
          title: text(
            section.title,
            WIREFRAME_LIMITS.shortText,
            "Section label",
          ),
          elements: array(
            section.elements,
            WIREFRAME_LIMITS.elementsPerSection,
            "Elements",
          ).map((value) => {
            if (++total > WIREFRAME_LIMITS.totalElements)
              fail("The draft has too many elements.");
            const e = object(value);
            keys(e, ["id", "kind", "label", "sourceIds", "destination"]);
            if (
              !WIREFRAME_ELEMENT_KINDS.includes(e.kind as WireframeElementKind)
            )
              fail("Unknown element type.");
            const destination = object(e.destination);
            keys(
              destination,
              destination.kind === "screen"
                ? ["kind", "screenId"]
                : destination.kind === "reference"
                  ? ["kind", "url"]
                  : ["kind"],
            );
            let target: WireframeDestination = { kind: "none" };
            if (destination.kind === "none") target = { kind: "none" };
            else if (destination.kind === "screen")
              target = {
                kind: "screen",
                screenId:
                  destination.screenId === ""
                    ? ""
                    : validId(destination.screenId),
              };
            else if (destination.kind === "reference")
              target = {
                kind: "reference",
                url: text(
                  destination.url,
                  WIREFRAME_LIMITS.url,
                  "Destination URL",
                ),
              };
            else fail("Unknown destination type.");
            const sourceIds = array(
              e.sourceIds,
              WIREFRAME_LIMITS.sources,
              "Element sources",
            ).map(validId);
            if (
              new Set(sourceIds).size !== sourceIds.length ||
              sourceIds.some((key) => !sources.some((s) => s.id === key))
            )
              fail("An element references an unknown source.");
            if (
              !["button", "link"].includes(e.kind as string) &&
              target.kind !== "none"
            )
              fail("Only buttons and links may have destinations.");
            return {
              id: id(e.id),
              kind: e.kind as WireframeElementKind,
              label: text(
                e.label,
                WIREFRAME_LIMITS.elementText,
                "Element text",
              ),
              sourceIds,
              destination: target,
            };
          }),
        };
      }),
    };
  });
  const selectedScreenId =
    d.selectedScreenId === null ? null : validId(d.selectedScreenId);
  if (
    selectedScreenId !== null &&
    !screens.some((s) => s.id === selectedScreenId)
  )
    fail("The selected screen is missing.");
  const draft: WireframeDraft = {
    schemaVersion: 1,
    projectId: scope,
    title: text(d.title, WIREFRAME_LIMITS.shortText, "Draft title"),
    intent: text(d.intent, WIREFRAME_LIMITS.notes, "Intent"),
    sources,
    screens,
    selectedScreenId,
    questions: text(d.questions, WIREFRAME_LIMITS.notes, "Questions"),
    assumptions: text(d.assumptions, WIREFRAME_LIMITS.notes, "Assumptions"),
    feedback: text(d.feedback, WIREFRAME_LIMITS.notes, "Feedback"),
    uxNotes: text(d.uxNotes, WIREFRAME_LIMITS.notes, "UX notes"),
  };
  if (
    new TextEncoder().encode(JSON.stringify(draft)).length >
    WIREFRAME_LIMITS.bytes
  )
    fail("The draft exceeds the 512 KiB export limit.");
  return draft;
}

/** URLs are references only, not fetch/open instructions. */
export function safeWireframeReference(value: string): string | null {
  if (
    typeof value !== "string" ||
    value.length > WIREFRAME_LIMITS.url ||
    /[\u0000-\u0020\u007f\\]/.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
export function resolveWireframeNavigation(
  draft: WireframeDraft,
  element: WireframeElement,
): string | null {
  if (
    !["button", "link"].includes(element.kind) ||
    !element.label.trim() ||
    element.destination.kind !== "screen"
  )
    return null;
  const targetId = element.destination.screenId;
  const target = draft.screens.find(
    (screen) => screen.id === targetId && screen.title.trim(),
  );
  return target?.id ?? null;
}
export function previewWireframeScreen(
  draft: WireframeDraft,
  screenId: string | null,
): WireframeScreen | null {
  const screen = draft.screens.find((s) => s.id === screenId);
  if (!screen || !screen.title.trim()) return null;
  return {
    ...screen,
    sections: screen.sections
      .map((section) => ({
        ...section,
        elements: section.elements.filter((element) => element.label.trim()),
      }))
      .filter((section) => section.title.trim() || section.elements.length),
  };
}
export function wireframeIssues(draft: WireframeDraft): WireframeIssue[] {
  const result: WireframeIssue[] = [];
  for (const source of draft.sources)
    if (
      source.kind === "link" &&
      source.value &&
      !safeWireframeReference(source.value)
    )
      result.push({
        id: source.id,
        message: "A source URL is invalid. It is retained as text only.",
      });
  for (const screen of draft.screens) {
    if (!screen.title.trim())
      result.push({
        id: screen.id,
        message: "An unnamed screen is excluded from the preview.",
      });
    for (const section of screen.sections)
      for (const e of section.elements) {
        if (!e.label.trim())
          result.push({
            id: e.id,
            message: "An empty element is excluded from the preview.",
          });
        if (
          e.destination.kind === "screen" &&
          !resolveWireframeNavigation(draft, e)
        )
          result.push({
            id: e.id,
            message:
              "A destination is missing or unnamed. Navigation is disabled.",
          });
        if (
          e.destination.kind === "reference" &&
          !safeWireframeReference(e.destination.url)
        )
          result.push({
            id: e.id,
            message:
              "A destination URL is invalid. It is retained as text only.",
          });
      }
  }
  return result;
}
export function removeWireframeScreen(
  draft: WireframeDraft,
  screenId: string,
): WireframeDraft {
  // Preserve references as unresolved, never silently redirect to another screen.
  return {
    ...draft,
    screens: draft.screens.filter((screen) => screen.id !== screenId),
    selectedScreenId:
      draft.selectedScreenId === screenId ? null : draft.selectedScreenId,
  };
}
export function removeWireframeSource(
  draft: WireframeDraft,
  sourceId: string,
): WireframeDraft {
  return {
    ...draft,
    sources: draft.sources.filter((source) => source.id !== sourceId),
    screens: draft.screens.map((screen) => ({
      ...screen,
      sections: screen.sections.map((section) => ({
        ...section,
        elements: section.elements.map((element) => ({
          ...element,
          sourceIds: element.sourceIds.filter((id) => id !== sourceId),
        })),
      })),
    })),
  };
}
export function exportWireframe(
  draft: WireframeDraft,
  now = new Date(),
): WireframeExport {
  const checked = validateWireframeDraft(draft);
  return {
    format: "astra.quick-wireframe",
    version: 1,
    mode: "manual",
    sharedSaved: false,
    aiGenerated: false,
    exportedAt: now.toISOString(),
    draft: checked,
    pending: wireframeIssues(checked),
  };
}
export function parseWireframeExport(
  raw: string,
  projectId: string,
): WireframeDraft {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > WIREFRAME_LIMITS.bytes * 2
  )
    fail("The export is too large.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    fail("The export is not valid JSON.");
  }
  const value = object(data);
  keys(value, [
    "format",
    "version",
    "mode",
    "sharedSaved",
    "aiGenerated",
    "exportedAt",
    "draft",
    "pending",
  ]);
  if (
    value.format !== "astra.quick-wireframe" ||
    value.version !== 1 ||
    value.mode !== "manual" ||
    value.sharedSaved !== false ||
    value.aiGenerated !== false
  )
    fail("Unsupported wireframe export.");
  return validateWireframeDraft(value.draft, projectId);
}
export function wireframeExportText(draft: WireframeDraft): string {
  const d = validateWireframeDraft(draft);
  const lines = [
    "ASTRA QUICK WIREFRAME · MANUAL DRAFT",
    "Not generated by AI. Not saved to the shared workspace. Not sent to UX.",
    `Project ID: ${d.projectId}`,
    `Title: ${d.title}`,
    `Intent: ${d.intent}`,
    "",
    "USER-ENTERED SOURCES",
  ];
  d.sources.forEach((source) =>
    lines.push(
      `[${source.id}] ${source.label} (${source.kind})`,
      source.value,
      "",
    ),
  );
  lines.push("USER-ENTERED SCREENS");
  d.screens.forEach((screen) => {
    lines.push(`Screen [${screen.id}]: ${screen.title}`);
    screen.sections.forEach((section) => {
      lines.push(`Section [${section.id}]: ${section.title}`);
      section.elements.forEach((element) => {
        lines.push(`${element.kind} [${element.id}]: ${element.label}`);
        if (element.destination.kind === "screen")
          lines.push(
            `Explicit screen destination: ${element.destination.screenId}`,
          );
        if (element.destination.kind === "reference")
          lines.push(
            `External destination reference (not opened): ${element.destination.url}`,
          );
        if (element.sourceIds.length)
          lines.push(`Sources: ${element.sourceIds.join(", ")}`);
      });
    });
  });
  lines.push(
    "",
    "OPEN QUESTIONS",
    d.questions,
    "",
    "USER-RECORDED ASSUMPTIONS",
    d.assumptions,
    "",
    "FEEDBACK",
    d.feedback,
    "",
    "NOTES FOR UX (NOT SENT)",
    d.uxNotes,
  );
  const pending = wireframeIssues(d);
  if (pending.length)
    lines.push(
      "",
      "UNRESOLVED PREVIEW ITEMS",
      ...pending.map((issue) => `[${issue.id}] ${issue.message}`),
    );
  return lines.join("\n");
}
