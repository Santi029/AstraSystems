import { useState, type Dispatch, type SetStateAction, type ReactNode } from 'react';
import { AssistantWorkspace } from './AssistantWorkspace';
type RecordValue = Record<string, any>;
type Props = {
 p: RecordValue; actor: string; roleLabel: string; drafts: Record<string,string>;
 setDrafts: Dispatch<SetStateAction<Record<string,string>>>; busy: boolean;
 action: (type: string, payload?: RecordValue, success?: string) => Promise<any>;
 viewProject: (project: any, section: string) => void;
 setModal: (value: {title: string; content: ReactNode}) => void;
 closeModal: () => void;
};
function Status({value}: {value: string}) { return <span className="status neutral">{value.replaceAll('_',' ')}</span>; }
/** Connected role-specific questionnaire. Mutations stay in App's guarded transport. */
export function StakeholderQuestionnaire({p,actor,roleLabel,drafts,setDrafts,busy,action,viewProject,setModal,closeModal}: Props) {
 const [questionIndex,setQuestionIndex] = useState(0);
 if (p.questionnaire?.assignedTo !== actor) return null;
        const qs = p.questionnaire?.questions || [
          "What problem should this product solve?",
          "Who is affected by the problem?",
          "What business outcome matters?",
          "What evidence supports the problem?",
          "Which users should be considered?",
          "What constraints should we know?",
          "What is in scope?",
          "What is outside the current scope?",
          "Who should be involved?",
          "What open questions remain?",
        ];
        const saved = p.questionnaire?.answers || {};
        const questionnaireLocked = p.questionnaire?.status !== "draft";
        const qprefix = "questionnaire:" + actor + ":" + p.id + ":";
        const allAnswers = Object.fromEntries(
          Array.from({ length: 10 }, (_, i) => [
            "q" + (i + 1),
            questionnaireLocked
              ? saved["q" + (i + 1)] || ""
              : (drafts[qprefix + "q" + (i + 1)] ?? saved["q" + (i + 1)] ?? ""),
          ]),
        );
        const answerValue = allAnswers["q" + (questionIndex + 1)];
        const answered = Object.values(allAnswers).filter(
          (v) => String(v).trim().length > 0,
        ).length;
        const submit = async (confirmAvailable = false) => {
          const r = await action(
            "submitQuestionnaire",
            { projectId: p.id, answers: allAnswers, confirmAvailable },
            "Available responses submitted for review.",
          );
          if (r) viewProject(p, "questionnaire");
        };
        return (
          <section className="panel padded narrow stakeholder-survey">
            <div className="inline spread">
              <h2>Stakeholder questionnaire</h2>
              <Status value={p.questionnaire?.status || "Draft"} />
            </div>
            <p className="muted">
              Ten optional questions. Save incomplete work whenever you need.
            </p>
            <div className="question-progress">
              <span>Question {questionIndex + 1} of 10</span>
              <span>
                {answered} answered · {10 - answered} pending
              </span>
            </div>
            <progress
              aria-label="Questionnaire navigation progress"
              value={questionIndex + 1}
              max={10}
            />
            <AssistantWorkspace
              context={{
                actorId: actor,
                projectId: p.id,
                projectName: p.name,
                roleLabel: roleLabel,
                scopeId: `question:${questionIndex + 1}`,
                scopeLabel: `Stakeholder question ${questionIndex + 1} of 10`,
              }}
            />
            <p className="helper">
              Assistant drafts are separate from your questionnaire answers.
              Review and save your own answer below.
            </p>
            <label className="question-label">
              {typeof qs[questionIndex] === "string"
                ? qs[questionIndex]
                : qs[questionIndex]?.text || qs[questionIndex]?.question}
              <textarea
                rows={6}
                value={answerValue}
                readOnly={questionnaireLocked}
                onChange={(e) =>
                  setDrafts((d) => ({
                    ...d,
                    [qprefix + "q" + (questionIndex + 1)]: e.target.value,
                  }))
                }
                placeholder="Add what you know, or leave pending."
              />
            </label>
            <div className="actions">
              <button
                disabled={questionIndex === 0}
                onClick={() => setQuestionIndex((i) => i - 1)}
              >
                Previous
              </button>
              <button
                disabled={busy || questionnaireLocked}
                onClick={() =>
                  action(
                    "saveQuestionnaire",
                    { projectId: p.id, answers: allAnswers },
                    "Questionnaire saved as a draft.",
                  )
                }
              >
                Save draft
              </button>
              {questionIndex < 9 && (
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    if (questionnaireLocked) {
                      setQuestionIndex((i) => i + 1);
                      return;
                    }
                    if (
                      (await action("saveQuestionnaire", {
                        projectId: p.id,
                        answers: allAnswers,
                      })) !== null
                    )
                      setQuestionIndex((i) => i + 1);
                  }}
                >
                  Save & next question
                </button>
              )}
            </div>
            <div className="form-footer">
              <p className="helper">
                {questionnaireLocked
                  ? "Submitted responses are read-only."
                  : "Next never submits responses."}
              </p>
              <button
                className="primary"
                disabled={busy || questionnaireLocked}
                onClick={() => {
                  if (answered === 10) {
                    submit();
                    return;
                  }
                  setModal({
                    title: "Some answers are still pending",
                    content: (
                      <>
                        <p>
                          {answered} answers are available and {10 - answered}{" "}
                          remain pending. Choose what happens next.
                        </p>
                        <div className="stack">
                          <button onClick={closeModal}>
                            Return to complete
                          </button>
                          <button
                            onClick={async () => {
                              closeModal();
                              await action(
                                "saveQuestionnaire",
                                { projectId: p.id, answers: allAnswers },
                                "Saved for later. Nothing was submitted.",
                              );
                            }}
                          >
                            Save for later
                          </button>
                          <button
                            className="primary"
                            onClick={async () => {
                              closeModal();
                              await submit(true);
                            }}
                          >
                            Submit available answers
                          </button>
                        </div>
                      </>
                    ),
                  });
                }}
              >
                Submit responses
              </button>
            </div>
          </section>
        );

}
