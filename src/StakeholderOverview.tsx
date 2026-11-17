import { recordedProjectProgress, recordedProjectStages } from './admin-dashboard-model';
import { recordedDate } from './dashboard-model';
import './stakeholder-preview.css';
import './stakeholder-connected.css';

type Project = {
  id: string; name: string; description?: string; endDate?: unknown;
  projectProgressPercent?: unknown; projectStages?: unknown;
  questionnaire?: { assignedTo?: string; status?: string; answers?: Record<string, unknown> } | null;
};
type Props = { project: Project; actorId: string; onOpenQuestionnaire: () => void; onOpenDocuments: () => void; onOpenActivity: () => void };

/** Connected presentation only. Server state and existing App transport own all data and mutations. */
export function StakeholderOverview({ project, actorId, onOpenQuestionnaire, onOpenDocuments, onOpenActivity }: Props) {
  // Assignment is project-scoped; a role in another project grants no access here.
  if (project.questionnaire?.assignedTo !== actorId) return null;
  const progress = recordedProjectProgress(project);
  const stages = recordedProjectStages(project);
  const questionnaire = project.questionnaire;
  const answers = questionnaire.answers || {};
  const answered = Array.from({length: 10}, (_, i) => answers[`q${i + 1}`]).filter(value => typeof value === 'string' && value.trim()).length;
  const editable = questionnaire.status === 'draft';
  return <div className="stakeholder-content-stack" aria-label="Stakeholder project workspace">
    <section className="panel padded">
      <h2>Project overview</h2>
      <p>{project.description || 'No project description recorded.'}</p>
      <div className="stakeholder-phases">
        <div className="inline spread"><h3>Project phases</h3><strong>{progress === null ? 'Progress not recorded' : `${progress}%`}</strong></div>
        {progress !== null && <progress value={progress} max={100} aria-label="Recorded project progress" />}
        {stages.length ? <ol>{stages.map((stage, index) => <li key={index}><strong>{stage.name}</strong><span>{stage.status}</span></li>)}</ol> : <p className="muted">No project phases recorded.</p>}
      </div>
      <div className="stakeholder-summary-grid"><div><span className="helper">Target date</span><strong>{recordedDate(project.endDate) || 'Not recorded'}</strong></div></div>
    </section>
    <section className="panel padded inline spread stakeholder-questionnaire-card">
      <div><h2>My questionnaire</h2><p>{answered} of 10 saved answers</p><p className="helper">{questionnaire.status || 'Status not recorded'}</p></div>
      <button className="primary" onClick={onOpenQuestionnaire}>{editable ? (answered ? 'Continue questionnaire' : 'Start questionnaire') : 'View responses'}</button>
    </section>
    <section className="panel padded"><h2>Project information</h2><div className="actions"><button onClick={onOpenDocuments}>View documents</button><button onClick={onOpenActivity}>View activity</button></div></section>
  </div>;
}
