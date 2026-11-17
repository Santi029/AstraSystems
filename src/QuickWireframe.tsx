import { useId, useRef, useState } from "react";
import {
  WIREFRAME_LIMITS as limits,
  WIREFRAME_ELEMENT_KINDS,
  createWireframeScreen,
  createWireframeSection,
  createWireframeElement,
  createWireframeSource,
  validateWireframeDraft,
  previewWireframeScreen,
  resolveWireframeNavigation,
  safeWireframeReference,
  wireframeIssues,
  removeWireframeScreen,
  removeWireframeSource,
  exportWireframe,
  wireframeExportText,
  type WireframeDraft,
  type WireframeScreen,
  type WireframeElement,
  type WireframeSource,
} from "./wireframe-model";
import "./wireframe.css";

/** Keep draft in the parent, keyed by authenticated identity + authorized project.
 * Clear it on sign-out. This component never creates a project or persists data.
 * Every editable field updates the controlled draft immediately, including empty
 * rows and incomplete URLs, so route changes do not discard unsubmitted inputs. */
export type QuickWireframeProps = {
  projectId: string;
  projectName: string;
  draft: WireframeDraft;
  onDraftChange: (draft: WireframeDraft) => void;
  canEdit?: boolean;
};

export function QuickWireframe(props: QuickWireframeProps) {
  // A project change must also discard transient export/undo UI from the old project.
  // The parent additionally keys by authenticated identity and clears drafts at sign-out.
  return <QuickWireframeEditor key={props.projectId} {...props} />;
}

function QuickWireframeEditor({
  projectId,
  projectName,
  draft,
  onDraftChange,
  canEdit = true,
}: QuickWireframeProps) {
  const scope = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<WireframeDraft | null>(null);
  const [copyableExport, setCopyableExport] = useState("");
  const [inspection, setInspection] = useState<{
    projectId: string;
    screenId: string | null;
  } | null>(null);
  const root = useRef<HTMLElement>(null);
  let invalid = "";
  try {
    validateWireframeDraft(draft, projectId);
  } catch (error) {
    invalid =
      error instanceof Error ? error.message : "The draft could not be read.";
  }
  if (invalid)
    return (
      <section className="quick-wireframe">
        <h2>Quick Wireframe</h2>
        <p role="alert">
          {invalid} Return to the matching project before editing.
        </p>
      </section>
    );

  const selected = draft.screens.find(
    (screen) => screen.id === draft.selectedScreenId,
  );
  const previewScreenId =
    !canEdit && inspection?.projectId === projectId
      ? inspection.screenId
      : draft.selectedScreenId;
  const preview = previewWireframeScreen(draft, previewScreenId);
  const issues = wireframeIssues(draft);
  const elementCount = draft.screens.reduce(
    (sum, screen) =>
      sum +
      screen.sections.reduce((n, section) => n + section.elements.length, 0),
    0,
  );
  const apply = (
    next: WireframeDraft,
    options: { removed?: boolean; message?: string } = {},
  ) => {
    if (!canEdit) return;
    try {
      const checked = validateWireframeDraft(next, projectId);
      setUndo(options.removed ? draft : null);
      onDraftChange(checked);
      setError("");
      setMessage(options.message || "");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The draft change could not be applied.",
      );
    }
  };
  const focusField = (id: string) =>
    requestAnimationFrame(() => {
      const field = document.getElementById(id);
      if (field && root.current?.contains(field)) field.focus();
    });
  const updateScreen = (next: WireframeScreen) =>
    apply({
      ...draft,
      screens: draft.screens.map((screen) =>
        screen.id === next.id ? next : screen,
      ),
    });
  const updateElement = (sectionId: string, element: WireframeElement) => {
    if (selected)
      updateScreen({
        ...selected,
        sections: selected.sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                elements: section.elements.map((item) =>
                  item.id === element.id ? element : item,
                ),
              }
            : section,
        ),
      });
  };
  const updateSource = (next: WireframeSource) =>
    apply({
      ...draft,
      sources: draft.sources.map((source) =>
        source.id === next.id ? next : source,
      ),
    });
  const exportLocal = (format: "json" | "text") => {
    try {
      const content =
        format === "json"
          ? JSON.stringify(exportWireframe(draft), null, 2)
          : wireframeExportText(draft);
      setCopyableExport(content);
      const blob = new Blob([content], {
        type:
          format === "json"
            ? "application/json;charset=utf-8"
            : "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `astra-wireframe-${projectId}.${format === "json" ? "json" : "txt"}`;
      document.body.appendChild(anchor);
      try {
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setError("");
      setMessage(
        "Local export prepared. Check your downloads, or copy the export text below. Nothing was shared.",
      );
    } catch {
      setError(
        "The download could not be prepared. If export text appears below, copy it before leaving.",
      );
    }
  };
  const goTo = (element: WireframeElement) => {
    const screenId = resolveWireframeNavigation(draft, element);
    if (!screenId) return;
    if (canEdit)
      apply(
        { ...draft, selectedScreenId: screenId },
        {
          message:
            "Preview moved to your explicit destination. No workflow was submitted.",
        },
      );
    else setInspection({ projectId, screenId });
    focusField(`${scope}-preview`);
  };

  return (
    <section
      className="quick-wireframe"
      aria-labelledby={`${scope}-title`}
      ref={root}
    >
      <header className="wf-heading">
        <div>
          <p className="wf-eyebrow">Project: {projectName}</p>
          <h2 id={`${scope}-title`}>Quick Wireframe</h2>
          <p>
            Describe only what you need, then inspect a neutral manual preview.
          </p>
        </div>
        <div className="wf-toolbar">
          <button type="button" onClick={() => exportLocal("json")}>
            Export JSON
          </button>
          <button type="button" onClick={() => exportLocal("text")}>
            Export text
          </button>
        </div>
      </header>
      <div className="wf-notice" role="note">
        <strong>Local draft for this tab</strong>
        <p>
          AI generation, file analysis and shared saving are unavailable here.
          Nothing is sent to UX. Export before closing or reloading the tab.
          Navigating inside Astra keeps this draft only while the parent
          workspace remains open.
        </p>
        <div className="wf-toolbar">
          <button
            type="button"
            disabled
            aria-describedby={`${scope}-unavailable`}
          >
            Generate with AI · unavailable
          </button>
          <button
            type="button"
            disabled
            aria-describedby={`${scope}-unavailable`}
          >
            Save to workspace · unavailable
          </button>
        </div>
        <p id={`${scope}-unavailable`} className="wf-help">
          The preview below is assembled from your explicit entries, not an
          AI-generated result.
        </p>
      </div>
      {!canEdit && (
        <p role="note">
          Read-only draft. You can inspect and export its recorded contents.
        </p>
      )}
      {error && (
        <p className="wf-error" role="alert">
          {error}
        </p>
      )}
      <div className="wf-live" role="status" aria-live="polite">
        {message}
        {undo && canEdit && (
          <button
            type="button"
            onClick={() =>
              apply(undo, { message: "The last removal was undone." })
            }
          >
            Undo last removal
          </button>
        )}
      </div>

      <fieldset disabled={!canEdit} className="wf-intent">
        <legend>1. Your input</legend>
        <label htmlFor={`${scope}-draft-title`}>
          Draft title
          <input
            id={`${scope}-draft-title`}
            value={draft.title}
            maxLength={limits.shortText}
            onChange={(event) => apply({ ...draft, title: event.target.value })}
          />
        </label>
        <label htmlFor={`${scope}-intent`}>
          What should this flow let someone do?
          <textarea
            id={`${scope}-intent`}
            value={draft.intent}
            rows={3}
            maxLength={limits.notes}
            onChange={(event) =>
              apply({ ...draft, intent: event.target.value })
            }
          />
        </label>
        <p className="wf-help">
          These notes are context only. They do not create screens, sections or
          controls automatically.
        </p>
        <details className="wf-details">
          <summary>Notes and reference links ({draft.sources.length})</summary>
          <p className="wf-help">
            Record source text or a URL. Links are not opened or analyzed.
            Attachments belong in the project’s attachment area.
          </p>
          {draft.sources.map((source, index) => (
            <fieldset className="wf-source" key={source.id}>
              <legend>Source {index + 1}</legend>
              <div className="wf-row">
                <label htmlFor={`${scope}-${source.id}-label`}>
                  Source label
                  <input
                    id={`${scope}-${source.id}-label`}
                    value={source.label}
                    maxLength={limits.shortText}
                    onChange={(event) =>
                      updateSource({ ...source, label: event.target.value })
                    }
                  />
                </label>
                <label htmlFor={`${scope}-${source.id}-kind`}>
                  Source type
                  <select
                    id={`${scope}-${source.id}-kind`}
                    value={source.kind}
                    onChange={(event) => {
                      const kind = event.target
                        .value as WireframeSource["kind"];
                      if (kind === "link" && source.value.length > limits.url) {
                        setError(
                          "This note is longer than the URL limit. Shorten it or add a separate link source; your note has not changed.",
                        );
                        return;
                      }
                      updateSource({ ...source, kind });
                    }}
                  >
                    <option value="note">Note</option>
                    <option value="link">Reference URL</option>
                  </select>
                </label>
              </div>
              <label htmlFor={`${scope}-${source.id}-value`}>
                {source.kind === "note"
                  ? "Source note"
                  : "Full HTTP or HTTPS reference URL"}
                <textarea
                  id={`${scope}-${source.id}-value`}
                  rows={2}
                  value={source.value}
                  maxLength={source.kind === "note" ? limits.notes : limits.url}
                  onChange={(event) =>
                    updateSource({ ...source, value: event.target.value })
                  }
                  aria-invalid={
                    source.kind === "link" &&
                    !!source.value &&
                    !safeWireframeReference(source.value)
                  }
                />
              </label>
              {source.kind === "link" &&
                source.value &&
                !safeWireframeReference(source.value) && (
                  <p className="wf-help">
                    This is not a valid HTTP(S) URL. It is retained as text
                    only.
                  </p>
                )}
              <button
                type="button"
                className="wf-remove"
                onClick={() =>
                  apply(removeWireframeSource(draft, source.id), {
                    removed: true,
                    message:
                      "Source and its citations removed from this local draft.",
                  })
                }
              >
                Remove source {index + 1} and its citations
              </button>
            </fieldset>
          ))}
          <button
            type="button"
            disabled={draft.sources.length >= limits.sources}
            onClick={() => {
              const source = createWireframeSource();
              apply({ ...draft, sources: [...draft.sources, source] });
              focusField(`${scope}-${source.id}-label`);
            }}
          >
            Add source
          </button>
          <span className="wf-help"> Up to {limits.sources} sources.</span>
        </details>
      </fieldset>

      <div className="wf-workspace">
        <fieldset disabled={!canEdit} className="wf-editor">
          <legend>2. Define screens and elements</legend>
          <p className="wf-help">
            Add only the elements you want. No header, navigation, footer or
            section is added for you.
          </p>
          <div className="wf-row">
            <label htmlFor={`${scope}-screen-select`}>
              Screen to edit
              <select
                id={`${scope}-screen-select`}
                value={draft.selectedScreenId ?? ""}
                onChange={(event) =>
                  apply({
                    ...draft,
                    selectedScreenId: event.target.value || null,
                  })
                }
              >
                <option value="">Select a screen</option>
                {draft.screens.map((screen, index) => (
                  <option key={screen.id} value={screen.id}>
                    {screen.title.trim() || `Unnamed screen ${index + 1}`}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={draft.screens.length >= limits.screens}
              onClick={() => {
                const screen = createWireframeScreen();
                apply({
                  ...draft,
                  screens: [...draft.screens, screen],
                  selectedScreenId: screen.id,
                });
                focusField(`${scope}-${screen.id}-title`);
              }}
            >
              Add screen
            </button>
          </div>
          {!draft.screens.length && (
            <p className="wf-empty">
              No screens yet. Add one to start a manual preview.
            </p>
          )}
          {selected && (
            <>
              <label htmlFor={`${scope}-${selected.id}-title`}>
                Screen name
                <input
                  id={`${scope}-${selected.id}-title`}
                  value={selected.title}
                  maxLength={limits.shortText}
                  onChange={(event) =>
                    updateScreen({ ...selected, title: event.target.value })
                  }
                />
              </label>
              <button
                type="button"
                className="wf-remove"
                onClick={() =>
                  apply(removeWireframeScreen(draft, selected.id), {
                    removed: true,
                    message:
                      "Screen removed. Existing links to it are now unresolved, not redirected.",
                  })
                }
              >
                Remove this screen
              </button>
              {selected.sections.map((section, sectionIndex) => (
                <fieldset className="wf-section-editor" key={section.id}>
                  <legend>Section {sectionIndex + 1}</legend>
                  <label htmlFor={`${scope}-${section.id}-title`}>
                    Section label (optional)
                    <input
                      id={`${scope}-${section.id}-title`}
                      value={section.title}
                      maxLength={limits.shortText}
                      onChange={(event) =>
                        updateScreen({
                          ...selected,
                          sections: selected.sections.map((item) =>
                            item.id === section.id
                              ? { ...item, title: event.target.value }
                              : item,
                          ),
                        })
                      }
                    />
                  </label>
                  {section.elements.map((element, index) => (
                    <fieldset className="wf-element-editor" key={element.id}>
                      <legend>Element {index + 1}</legend>
                      <label htmlFor={`${scope}-${element.id}-kind`}>
                        Element type
                        <select
                          id={`${scope}-${element.id}-kind`}
                          value={element.kind}
                          onChange={(event) => {
                            const kind = event.target
                              .value as WireframeElement["kind"];
                            updateElement(section.id, {
                              ...element,
                              kind,
                              destination: ["button", "link"].includes(kind)
                                ? element.destination
                                : { kind: "none" },
                            });
                          }}
                        >
                          {WIREFRAME_ELEMENT_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind === "input"
                                ? "Input field"
                                : kind[0].toUpperCase() + kind.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="wf-help">
                        Changing to text or an input field clears that element’s
                        destination.
                      </p>
                      <label htmlFor={`${scope}-${element.id}-label`}>
                        {element.kind === "text"
                          ? "Text to display"
                          : "Exact control label"}
                        <textarea
                          id={`${scope}-${element.id}-label`}
                          value={element.label}
                          maxLength={limits.elementText}
                          rows={2}
                          onChange={(event) =>
                            updateElement(section.id, {
                              ...element,
                              label: event.target.value,
                            })
                          }
                        />
                      </label>
                      {["button", "link"].includes(element.kind) && (
                        <>
                          <label htmlFor={`${scope}-${element.id}-destination`}>
                            Destination
                            <select
                              id={`${scope}-${element.id}-destination`}
                              value={element.destination.kind}
                              onChange={(event) =>
                                updateElement(section.id, {
                                  ...element,
                                  destination:
                                    event.target.value === "screen"
                                      ? { kind: "screen", screenId: "" }
                                      : event.target.value === "reference"
                                        ? { kind: "reference", url: "" }
                                        : { kind: "none" },
                                })
                              }
                            >
                              <option value="none">Not defined</option>
                              <option value="screen">
                                A screen in this draft
                              </option>
                              <option value="reference">
                                External URL reference (not opened)
                              </option>
                            </select>
                          </label>
                          {element.destination.kind === "screen" && (
                            <label htmlFor={`${scope}-${element.id}-target`}>
                              Explicit target screen
                              <select
                                id={`${scope}-${element.id}-target`}
                                value={element.destination.screenId}
                                onChange={(event) =>
                                  updateElement(section.id, {
                                    ...element,
                                    destination: {
                                      kind: "screen",
                                      screenId: event.target.value,
                                    },
                                  })
                                }
                              >
                                <option value="">Choose a destination</option>
                                {element.destination.screenId &&
                                  !draft.screens.some(
                                    (s) =>
                                      s.id ===
                                      (
                                        element.destination as {
                                          screenId: string;
                                        }
                                      ).screenId,
                                  ) && (
                                    <option
                                      value={element.destination.screenId}
                                    >
                                      Removed destination
                                    </option>
                                  )}
                                {draft.screens
                                  .filter((screen) => screen.title.trim())
                                  .map((screen) => (
                                    <option key={screen.id} value={screen.id}>
                                      {screen.title}
                                    </option>
                                  ))}
                              </select>
                            </label>
                          )}
                          {element.destination.kind === "reference" && (
                            <label htmlFor={`${scope}-${element.id}-url`}>
                              Destination URL (reference only)
                              <input
                                id={`${scope}-${element.id}-url`}
                                value={element.destination.url}
                                maxLength={limits.url}
                                onChange={(event) =>
                                  updateElement(section.id, {
                                    ...element,
                                    destination: {
                                      kind: "reference",
                                      url: event.target.value,
                                    },
                                  })
                                }
                                aria-invalid={
                                  !!element.destination.url &&
                                  !safeWireframeReference(
                                    element.destination.url,
                                  )
                                }
                              />
                            </label>
                          )}
                        </>
                      )}
                      {!!draft.sources.length && (
                        <details className="wf-citations">
                          <summary>
                            Trace to sources ({element.sourceIds.length})
                          </summary>
                          {draft.sources.map((source, sourceIndex) => (
                            <label className="wf-check" key={source.id}>
                              <input
                                type="checkbox"
                                checked={element.sourceIds.includes(source.id)}
                                onChange={(event) =>
                                  updateElement(section.id, {
                                    ...element,
                                    sourceIds: event.target.checked
                                      ? [...element.sourceIds, source.id]
                                      : element.sourceIds.filter(
                                          (id) => id !== source.id,
                                        ),
                                  })
                                }
                              />
                              {source.label.trim() ||
                                `Unlabeled source ${sourceIndex + 1}`}
                            </label>
                          ))}
                        </details>
                      )}
                      <button
                        type="button"
                        className="wf-remove"
                        onClick={() =>
                          apply(
                            {
                              ...draft,
                              screens: draft.screens.map((screen) =>
                                screen.id === selected.id
                                  ? {
                                      ...screen,
                                      sections: screen.sections.map((item) =>
                                        item.id === section.id
                                          ? {
                                              ...item,
                                              elements: item.elements.filter(
                                                (e) => e.id !== element.id,
                                              ),
                                            }
                                          : item,
                                      ),
                                    }
                                  : screen,
                              ),
                            },
                            {
                              removed: true,
                              message: "Element removed from this local draft.",
                            },
                          )
                        }
                      >
                        Remove element {index + 1}
                      </button>
                    </fieldset>
                  ))}
                  <div className="wf-toolbar">
                    <button
                      type="button"
                      disabled={
                        section.elements.length >= limits.elementsPerSection ||
                        elementCount >= limits.totalElements
                      }
                      onClick={() => {
                        const element = createWireframeElement();
                        updateScreen({
                          ...selected,
                          sections: selected.sections.map((item) =>
                            item.id === section.id
                              ? {
                                  ...item,
                                  elements: [...item.elements, element],
                                }
                              : item,
                          ),
                        });
                        focusField(`${scope}-${element.id}-label`);
                      }}
                    >
                      Add element
                    </button>
                    <button
                      type="button"
                      className="wf-remove"
                      onClick={() =>
                        apply(
                          {
                            ...draft,
                            screens: draft.screens.map((screen) =>
                              screen.id === selected.id
                                ? {
                                    ...screen,
                                    sections: screen.sections.filter(
                                      (item) => item.id !== section.id,
                                    ),
                                  }
                                : screen,
                            ),
                          },
                          {
                            removed: true,
                            message:
                              "Section and its elements removed from this local draft.",
                          },
                        )
                      }
                    >
                      Remove section {sectionIndex + 1}
                    </button>
                  </div>
                </fieldset>
              ))}
              <button
                type="button"
                disabled={selected.sections.length >= limits.sectionsPerScreen}
                onClick={() => {
                  const section = createWireframeSection();
                  updateScreen({
                    ...selected,
                    sections: [...selected.sections, section],
                  });
                  focusField(`${scope}-${section.id}-title`);
                }}
              >
                Add section
              </button>
            </>
          )}
          <p className="wf-help">
            Limits: {limits.screens} screens, {limits.sectionsPerScreen}{" "}
            sections per screen, {limits.elementsPerSection} elements per
            section, {limits.totalElements} elements in total.
          </p>
        </fieldset>

        <section
          className="wf-preview-panel"
          aria-labelledby={`${scope}-preview-title`}
        >
          <h3 id={`${scope}-preview-title`}>Manual preview</h3>
          <p className="wf-help">
            Only named screens and nonempty entries appear. Buttons and links
            navigate only to an explicit, named screen. External links are
            recorded, never opened. Inputs collect no data.
          </p>
          {!canEdit && (
            <label htmlFor={`${scope}-inspect`}>
              Screen to inspect
              <select
                id={`${scope}-inspect`}
                value={previewScreenId ?? ""}
                onChange={(event) =>
                  setInspection({
                    projectId,
                    screenId: event.target.value || null,
                  })
                }
              >
                <option value="">Select a screen</option>
                {draft.screens
                  .filter((screen) => screen.title.trim())
                  .map((screen) => (
                    <option key={screen.id} value={screen.id}>
                      {screen.title}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <div
            className="wf-canvas"
            id={`${scope}-preview`}
            tabIndex={-1}
            aria-label="Manual wireframe preview"
          >
            {!preview ? (
              <p className="wf-empty">
                No screen to preview. Select a screen and enter its name.
              </p>
            ) : (
              <>
                <h4 className="wf-screen-name">{preview.title}</h4>
                {!preview.sections.length && (
                  <p className="wf-empty">
                    No elements have been entered for this screen.
                  </p>
                )}
                {preview.sections.map((section) => (
                  <section
                    className="wf-preview-section"
                    key={section.id}
                    aria-label={section.title || undefined}
                  >
                    {section.title.trim() && <h5>{section.title}</h5>}
                    {section.elements.map((element) => (
                      <div className="wf-preview-element" key={element.id}>
                        {element.kind === "text" ? (
                          <p className="wf-user-text">{element.label}</p>
                        ) : element.kind === "input" ? (
                          <label>
                            {element.label}
                            <input
                              readOnly
                              value=""
                              aria-label={element.label}
                              aria-describedby={`${scope}-preview-readonly`}
                            />
                          </label>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={
                                element.kind === "link"
                                  ? "wf-preview-link"
                                  : "wf-preview-button"
                              }
                              disabled={
                                !resolveWireframeNavigation(draft, element)
                              }
                              onClick={() => goTo(element)}
                            >
                              {element.label}
                            </button>
                            {!resolveWireframeNavigation(draft, element) && (
                              <p className="wf-help">
                                {element.destination.kind === "reference"
                                  ? "External destination recorded only; not opened."
                                  : "No usable screen destination defined."}
                              </p>
                            )}
                          </>
                        )}
                        {!!element.sourceIds.length && (
                          <p className="wf-provenance">
                            Sources:{" "}
                            {element.sourceIds
                              .map((id) => {
                                const source = draft.sources.find(
                                  (s) => s.id === id,
                                );
                                return (
                                  source?.label.trim() ||
                                  `Source ${draft.sources.findIndex((s) => s.id === id) + 1}`
                                );
                              })
                              .join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </section>
                ))}
              </>
            )}
          </div>
          <p id={`${scope}-preview-readonly`} className="wf-help">
            Input fields are visual previews only. No form submission or data
            collection is implemented.
          </p>
          {!!issues.length && (
            <details className="wf-details">
              <summary>Unresolved preview items ({issues.length})</summary>
              <ul>
                {issues.map((issue, index) => (
                  <li key={`${issue.id}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>

      <fieldset className="wf-continuity" disabled={!canEdit}>
        <legend>3. Questions, feedback and UX continuity</legend>
        <p className="wf-help">
          Record what still needs an answer. No assumptions, phases or estimates
          are filled in automatically.
        </p>
        <div className="wf-row">
          <label htmlFor={`${scope}-questions`}>
            Open questions
            <textarea
              id={`${scope}-questions`}
              rows={3}
              value={draft.questions}
              maxLength={limits.notes}
              onChange={(event) =>
                apply({ ...draft, questions: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${scope}-assumptions`}>
            Your assumptions to validate
            <textarea
              id={`${scope}-assumptions`}
              rows={3}
              value={draft.assumptions}
              maxLength={limits.notes}
              onChange={(event) =>
                apply({ ...draft, assumptions: event.target.value })
              }
            />
          </label>
        </div>
        <div className="wf-row">
          <label htmlFor={`${scope}-feedback`}>
            Feedback to carry forward
            <textarea
              id={`${scope}-feedback`}
              rows={3}
              value={draft.feedback}
              maxLength={limits.notes}
              onChange={(event) =>
                apply({ ...draft, feedback: event.target.value })
              }
            />
          </label>
          <label htmlFor={`${scope}-ux`}>
            Notes for UX look and feel (not sent)
            <textarea
              id={`${scope}-ux`}
              rows={3}
              value={draft.uxNotes}
              maxLength={limits.notes}
              onChange={(event) =>
                apply({ ...draft, uxNotes: event.target.value })
              }
            />
          </label>
        </div>
        <button
          type="button"
          disabled
          aria-describedby={`${scope}-ux-unavailable`}
        >
          Send to UX · unavailable
        </button>
        <p id={`${scope}-ux-unavailable`} className="wf-help">
          Export includes these notes for a later handoff. Preparing them does
          not notify, assign work to, or share with anyone.
        </p>
      </fieldset>
      {copyableExport && (
        <details className="wf-details" open>
          <summary>Copyable local export</summary>
          <label htmlFor={`${scope}-copy`}>
            Export text (select and copy if the download is unavailable)
            <textarea
              id={`${scope}-copy`}
              readOnly
              rows={8}
              value={copyableExport}
            />
          </label>
        </details>
      )}
    </section>
  );
}

export default QuickWireframe;
