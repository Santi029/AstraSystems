import { isActiveVerifiedPerson } from './backend-contract.ts';

type Row = Record<string, any>;
const row = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
/** UI eligibility only; current server identity, ownership and revision stay authoritative. */
export function specialistAssignedTasks(project: unknown, actorId: string) {
  if (!row(project) || !actorId || project.questionnaire?.assignedTo === actorId || !Array.isArray(project.tasks)) return [];
  return project.tasks.filter((task: unknown): task is Row => row(task) && typeof task.id === 'string' && task.id.length > 0 && task.ownerId === actorId);
}
export function specialistSelection(state: unknown, projectId: string, actorId: string, taskIds: unknown) {
  if (!row(state) || !Array.isArray(state.projects) || !row(state.currentActor) || state.currentActor.id !== actorId || (state.demo !== true && !isActiveVerifiedPerson(state.currentActor)))
    return { ok: false as const, message: 'Refresh your verified workspace before selecting work.' };
  const project = state.projects.find((p: unknown) => row(p) && p.id === projectId);
  const owned = new Set(specialistAssignedTasks(project, actorId).map(task => task.id));
  if (!Array.isArray(taskIds) || !taskIds.length || new Set(taskIds).size !== taskIds.length || taskIds.some(id => typeof id !== 'string' || !owned.has(id)))
    return { ok: false as const, message: 'Select only work currently assigned to you. Refresh if assignments changed.' };
  return { ok: true as const, payload: { projectId, taskIds: [...taskIds] as string[] } };
}

/** Save/submit only current owned drafts; never silently trim a submission package. */
export function specialistDocumentAction(state: unknown, projectId: string, actorId: string, documentIds: string[], expectedVersions: Record<string, number>) {
  if (!row(state) || !Array.isArray(state.projects)) return { ok: false as const, message: 'Refresh your workspace.' };
  const project = state.projects.find((p: unknown) => row(p) && p.id === projectId);
  const docs = row(project) && Array.isArray(project.documents) ? project.documents : [];
  const selected = documentIds.map(id => docs.find((d: unknown) => row(d) && d.id === id));
  if (!documentIds.length || new Set(documentIds).size !== documentIds.length || selected.some(d => !row(d) || d.ownerId !== actorId || d.canEdit === false || d.workingVersion !== expectedVersions[d.id] || !Array.isArray(d.versions) || !d.versions.some((v: unknown) => row(v) && v.version === d.workingVersion && v.status === 'draft')))
    return { ok: false as const, message: 'The selected saved drafts changed or are no longer editable. Refresh and review the package again.' };
  const taskIds = [...new Set(selected.map(d => d.taskId))];
  if (taskIds.length !== 1 || !specialistSelection(state, projectId, actorId, taskIds).ok)
    return { ok: false as const, message: 'Choose your own saved drafts from one assigned specialist task.' };
  return { ok: true as const, documentIds: [...documentIds] };
}
