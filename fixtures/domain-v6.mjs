import { randomUUID, createHash } from 'node:crypto';

export class DomainError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message); this.code = code; this.status = status; this.details = details;
  }
}
const fail = (code, message, status = 400, details) => { throw new DomainError(code, message, status, details); };
const clone = value => structuredClone(value);
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${randomUUID()}`;
const text = (value, name, { allowEmpty = false, max = 100000 } = {}) => {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) fail('INVALID_INPUT', `${name} must be ${allowEmpty ? 'text' : 'non-empty text'} (maximum ${max} characters).`);
  return value;
};
export const ACTORS = [
  { id: 'admin', name: 'Elena Torres', label: 'Project Admin', companyIntegrationAdmin: false },
  { id: 'specialist', name: 'Mateo Ruiz', label: 'UX Specialist', companyIntegrationAdmin: false },
  { id: 'stakeholder', name: 'Lucía Vega', label: 'Stakeholder', companyIntegrationAdmin: false },
  { id: 'integration', name: 'Nora Campos', label: 'Company integration administrator', companyIntegrationAdmin: true },
  { id: 'outsider', name: 'Alex Silva', label: 'Unassigned person', companyIntegrationAdmin: false },
];
export const DECISIONS = [
  { id: 'create-project', title: 'Create Project rules', status: 'Open', detail: 'Required fields, date rules, duplicate handling and full validation variants need product approval. This demo requires only a display name and an explicitly selected administrator to create a usable synthetic record.' },
  { id: 'handover', title: 'Role removal and handover', status: 'Blocked', detail: 'Role removal, replacement and task transfer are blocked until ownership and in-progress-work policy is agreed.' },
  { id: 'completion', title: 'Completion and source applicability', status: 'Open', detail: 'Complete is a manual demo declaration, separate from submission. Eligibility and required source rules remain undecided. The eight-source set is fixture data only.' },
  { id: 'integration', title: 'Live integration mapping', status: 'Open', detail: 'ClickUp workspace, fields, task granularity, progress and document access remain undecided. All provider actions in this build are local simulations.' },
  { id: 'voice', title: 'Live voice and AI', status: 'Open', detail: 'No live OpenAI or voice service is connected. Local suggestions are deterministic simulations. Provider setup, retention and costs require review.' },
  { id: 'teams', title: 'Teams action flows', status: 'Open', detail: 'Message, notification and calendar actions are not implemented pending product mapping.' },
  { id: 'windows', title: 'Windows installation', status: 'Unverified', detail: 'An installable Windows package must be built and tested on Windows. A local web preview is not installation evidence.' },
  { id: 'production', title: 'Production architecture', status: 'Open', detail: 'Synthetic persona selection is not authentication. Atomic JSON storage is for local single-process evaluation only. Shared identity, hosting, retention and production security remain undecided.' },
];
const QUESTIONS = [
  'What problem should this product solve?', 'Who will use the product?', 'What outcome would make the project successful?',
  'Which current process should improve?', 'What capabilities matter most?', 'What constraints should the team know?',
  'Which people should be consulted?', 'What evidence is already available?', 'What risks or dependencies exist?', 'What else should the team consider?',
];
// Explicit role labels already used by the shared specialist workflow and UI.
// Arbitrary labels do not implicitly grant task ownership or questionnaire access.
const SPECIALIST_ROLES = new Set(['specialist', 'ux specialist', 'researcher', 'ux / ui design', 'brand identity', 'architecture', 'security', 'development', 'devops', 'qa']);
const SOURCE_IDS = ['research', 'goals', 'methods', 'brand', 'architecture', 'security', 'development', 'qa'];
const TITLES = ['Research Findings', 'Experience Goals', 'Methods and Participants', 'Brand Identity', 'Architecture', 'Security', 'Development', 'Quality Assurance'];
const documentSnapshot = (doc, version = doc.versions.at(-1)) => ({ documentId: doc.id, version: version.version, title: doc.title, content: version.content });
const fixtureProject = (projectId, ready = false) => {
  const timestamp = '2026-11-11T09:00:00.000Z';
  const documents = SOURCE_IDS.map((docId, i) => {
    const version = ready ? 1 : i < 3 ? 3 : 1;
    const status = ready || docId === 'brand' ? 'approved' : i < 2 ? 'submitted' : 'draft';
    const content = `# ${TITLES[i]}\n\nSynthetic evaluation content for ${ready ? 'Orbit Service' : 'Atlas Workspace'}.\n\n${i === 0 ? 'Participants need a clear view of pending actions and a reliable way to review exact versions. Research evidence is illustrative, not verified research.' : i === 1 ? 'Keep task selection, saved drafts, submissions and approvals distinct. Make each next action clear.' : i === 2 ? 'Draft methods and participant plan. This document is intentionally excluded from the two-document v3 submission.' : 'This source demonstrates version traceability only. Discipline-specific evidence mapping remains open.'}`;
    return { id: docId, title: TITLES[i], ownerId: 'specialist', taskId: i < 3 ? 'ux-discovery' : `task-${docId}`, workingVersion: status === 'draft' ? version : null, versions: [{ version, status, content, savedAt: timestamp, ...(status === 'approved' ? { approvedAt: timestamp, approvedBy: 'admin' } : {}) }] };
  });
  const delivery = { id: ready ? 'ready-delivery-v1' : 'delivery-v3', version: ready ? 1 : 3, status: ready ? 'approved' : 'submitted', documentVersions: documents.filter((_, i) => ready || i < 2).map(doc => documentSnapshot(doc)), excludedDocumentIds: ready ? [] : ['methods'], submittedBy: 'specialist', submittedAt: timestamp, reviewedBy: ready ? 'admin' : null, reviewedAt: ready ? timestamp : null, feedback: '', history: [{ action: 'submitted', actorId: 'specialist', at: timestamp }] };
  documents.push({ id: 'devops', title: 'DevOps', ownerId: 'specialist', taskId: 'task-devops', workingVersion: 1, versions: [{ version: 1, status: 'draft', content: '# DevOps\n\nOptional synthetic working document. Deployment, operations, hosting and discipline-specific evidence mappings remain open. This document is not part of the fixture’s eight required PRD sources.', savedAt: timestamp }] });
  const project = {
    id: projectId, name: ready ? 'Orbit Service' : 'Atlas Workspace', description: ready ? 'Ready fixture: eight synthetic approved source versions. Not a universal source rule.' : 'A synthetic product project for the Admin review and specialist correction flow.', startDate: '2026-11-11', endDate: '2026-12-18', adminIds: ['admin'],
    team: [{ personId: 'admin', roles: ['Admin'] }, { personId: 'specialist', roles: ['UX Specialist', 'Researcher'] }, { personId: 'stakeholder', roles: ['Stakeholder'] }],
    tasks: [{ id: 'ux-discovery', title: 'Prepare UX discovery', ownerId: 'specialist', documentIds: ['research', 'goals', 'methods'], status: 'active', completedAt: null, linkedTaskId: `SIM-${projectId}-UX`, priority: 3 }, ...SOURCE_IDS.slice(3).map(docId => ({ id: `task-${docId}`, title: `Prepare ${TITLES[SOURCE_IDS.indexOf(docId)]}`, ownerId: 'specialist', documentIds: [docId], status: 'active', completedAt: null, linkedTaskId: `SIM-${projectId}-${docId.toUpperCase()}`, priority: 2 }))],
    documents, deliveries: [delivery], notifications: ready ? [] : [{ id: 'notice-v3', deliveryId: 'delivery-v3', title: 'Mateo submitted UX discovery v3', readBy: [], createdAt: timestamp }],
    prd: { version: 0, status: 'not_started', title: 'Product Requirements', content: '', requiredSourceIds: [...SOURCE_IDS], sourceVersions: [], history: [], fixtureRule: 'Eight applicable sources belong to this fixture only; product applicability rules remain open.' },
    questionnaire: { assignedTo: 'stakeholder', questions: QUESTIONS.map((question, i) => ({ id: `q${i + 1}`, text: question, optional: true })), answers: Object.fromEntries(QUESTIONS.map((_, i) => [`q${i + 1}`, i < 7 ? ['Reduce friction in internal project reviews.', 'Multidisciplinary product teams.', 'A clear, reviewed specification.', 'Document handoffs and approvals.', 'Traceable versions and clear ownership.', 'Use synthetic data for evaluation.', 'Product, UX and engineering representatives.'][i] : ''])), status: 'draft', savedAt: timestamp, submissions: [] },
    connector: { provider: 'ClickUp', mode: 'simulation', companyPermission: 'simulation_only', providerConsent: 'not_connected', connectionStatus: 'not_connected', projectAuthority: 'Admin', taskMapping: 'synthetic', documentAccess: 'local_only_not_external' },
    externalOperations: [], audit: [{ id: `audit-${projectId}`, action: 'fixture_created', actorId: 'system', at: timestamp, details: { synthetic: true } }],
    conversations: {}, workSelections: {},
  };
  project.tasks.push({ id: 'task-devops', title: 'Prepare DevOps', ownerId: 'specialist', documentIds: ['devops'], status: 'available', completedAt: null, linkedTaskId: `SIM-${projectId}-DEVOPS`, priority: 2, requiredForPrd: false });
  if (ready) {
    project.prd = { ...project.prd, version: 1, status: 'draft', sourceVersions: currentSources(project), content: makePrdContent(project), preparedBy: 'admin', preparedAt: timestamp };
  }
  return project;
};
export function createInitialState(scenario = 'default') {
  if (!['default', 'ready', 'incomplete'].includes(scenario)) fail('INVALID_SCENARIO', 'Unknown synthetic scenario.');
  return { schemaVersion: 1, demo: true, revision: 0, createdAt: now(), actors: clone(ACTORS), people: clone(ACTORS), decisions: clone(DECISIONS), projects: [fixtureProject('atlas', scenario === 'ready'), fixtureProject('ready', true)], integrations: { mode: 'simulation', providers: [{ name: 'OpenAI', status: 'not_connected' }, { name: 'ClickUp', status: 'simulation' }, { name: 'Microsoft Teams', status: 'not_implemented' }] }, _providerReceipts: [] };
}
/** Real workspace starts empty. Identity/roles are hydrated by the trusted backend. */
export function createAccountState() {
  return { schemaVersion: 1, demo: false, revision: 0, createdAt: now(), actors: [], people: [], decisions: clone(DECISIONS), projects: [], integrations: { mode: 'not_connected', providers: [{ name: 'OpenAI', status: 'not_connected' }, { name: 'ClickUp', status: 'not_connected' }, { name: 'Microsoft Teams', status: 'not_implemented' }] }, _providerReceipts: [] };
}
function canCreateProjects(state, actor) { return state.demo === true ? actor.id === 'admin' : actor.globalRoles?.includes('Admin') === true; }
function actorFor(state, actorId) { return state.actors.find(a => a.id === actorId) ?? fail('UNKNOWN_ACTOR', 'Select a known synthetic persona.', 401); }
function member(project, actorId) { return project.adminIds.includes(actorId) || project.team.some(t => t.personId === actorId && t.roles.length); }
function projectFor(state, projectId, actorId) { const p = state.projects.find(p => p.id === projectId); if (!p || !member(p, actorId)) fail('PROJECT_ACCESS_DENIED', 'This persona is not assigned to that project.', 403); return p; }
function isProjectAdmin(state, project, actorId) { return project.adminIds.includes(actorId) && (state.demo === true || canCreateProjects(state, actorFor(state, actorId))); }
function adminOnly(state, project, actorId) { if (!isProjectAdmin(state, project, actorId)) fail('ADMIN_REQUIRED', 'This action requires the project assignment and current workspace Admin authority.', 403); }
function assignedPersonWithRole(state, project, personId, predicate, roleName) {
  const person = state.actors.find(p => p.id === personId);
  if (!person || person.active === false || (person.status !== undefined && person.status !== 'active')) fail('ACTIVE_MEMBER_REQUIRED', 'Select an active verified project member.', 403);
  const membership = project.team.find(entry => entry.personId === personId);
  if (!membership || !membership.roles.some(role => predicate(role.trim().toLowerCase()))) fail('PROJECT_ROLE_REQUIRED', `The selected person must have an explicit ${roleName} role in this project.`, 403);
  return person;
}
function documentFor(project, documentId) { return project.documents.find(d => d.id === documentId) ?? fail('DOCUMENT_NOT_FOUND', 'Document not found.', 404); }
function readOnlyStakeholder(state, actorId) {
  if (state.demo === true) return false;
  const roles = actorFor(state, actorId).globalRoles ?? [];
  return roles.includes('Stakeholder') && !roles.some(role => role === 'Admin' || SPECIALIST_ROLES.has(role.toLowerCase()) || ['UX Designer', 'Full Stack Development'].includes(role));
}
function documentEditAllowed(state, project, doc, actorId) {
  const actor = actorFor(state, actorId), grant = project.documentEditPermissions?.[doc.id];
  const version = actor.accessVersion;
  return doc.ownerId === actorId && (!readOnlyStakeholder(state, actorId) ||
    (Number.isSafeInteger(version) && version > 0 && grant?.userId === actorId && grant.allowed === true &&
      grant.ownerAccessVersion === version && grant.projectRoleEpoch === (project.documentEditEpochs?.[actorId] ?? 0)));
}
function ownDocument(state, project, documentId, actorId) { const d = documentFor(project, documentId); if (d.ownerId !== actorId) fail('OWNER_REQUIRED', 'Only the assigned specialist can change this document.', 403); if (!documentEditAllowed(state, project, d, actorId)) fail('DOCUMENT_READ_ONLY', 'Your current Stakeholder role has read-only access to this document. Ask the project Admin for explicit document edit permission.', 403); return d; }
function deliveryFor(project, deliveryId) { return project.deliveries.find(d => d.id === deliveryId) ?? fail('DELIVERY_NOT_FOUND', 'Delivery not found.', 404); }
function taskFor(project, taskId) { return project.tasks.find(t => t.id === taskId) ?? fail('TASK_NOT_FOUND', 'Task not found.', 404); }
function audit(project, actorId, action, details) { project.audit.push({ id: id('audit'), actorId, action, at: now(), details }); }
export function currentSources(project) { return project.prd.requiredSourceIds.map(documentId => { const v = documentFor(project, documentId).versions.at(-1); return { documentId, version: v.version, contentHash: createHash('sha256').update(v.content).digest('hex') }; }); }
const sourceKey = sources => {
  if (sources.some(s => !s || typeof s.documentId !== 'string' || !Number.isInteger(s.version))) fail('INVALID_SOURCES', 'Source versions must identify a document and integer version.');
  return JSON.stringify([...sources].sort((a, b) => a.documentId.localeCompare(b.documentId)).map(s => ({ documentId: s.documentId, version: s.version, contentHash: s.contentHash })));
};
export function readiness(project) {
  const current = currentSources(project);
  const missing = current.filter(s => documentFor(project, s.documentId).versions.find(v => v.version === s.version).status !== 'approved');
  const changedSources = project.prd.version > 0 && (sourceKey(project.prd.sourceVersions) !== sourceKey(current) || (project.prd.sourceSelectionVersion ?? 0) !== (project.prd.preparedSelectionVersion ?? 0));
  return { approved: current.length - missing.length, total: current.length, ready: current.length > 0 && missing.length === 0 && !changedSources, changedSources, missing };
}
function makePrdContent(project, demo = true) { return `# ${project.name}: Product Requirements\n\n${demo ? 'Synthetic assembled draft.' : 'Assembled from explicitly selected project sources.'} Human review required.\n\n${project.prd.requiredSourceIds.map(documentId => { const d = documentFor(project, documentId); const v = d.versions.at(-1); return `## ${d.title} · v${v.version} · ${v.status}\n\n${v.content}`; }).join('\n\n')}`; }
export function viewState(state, actorId = 'admin') {
  const actor = actorFor(state, actorId); const result = clone(state); delete result._providerReceipts;
  result.currentActor = clone(actor);
  result.capabilities = { syntheticIdentity: state.demo === true, companyIntegrationAdmin: actor.companyIntegrationAdmin === true, createProject: canCreateProjects(state, actor), manageAccounts: state.demo !== true && canCreateProjects(state, actor), liveIntegrations: false, productionReady: false };
  result.projects = result.projects.filter(p => member(p, actorId)).map(p => {
    p.isAdmin = isProjectAdmin(state, p, actorId);
    p.prd.readiness = readiness(p);
    p.summary = { submitted: p.deliveries.filter(d => d.status === 'submitted').length, underReview: p.deliveries.filter(d => d.status === 'under_review').length, needsReview: p.deliveries.filter(d => ['submitted', 'under_review'].includes(d.status)).length, completedTasks: p.tasks.filter(t => t.status === 'complete').length, totalTasks: p.tasks.length };
    if (!p.isAdmin) {
      p.tasks = p.tasks.filter(t => t.ownerId === actorId);
      p.documents = p.documents.filter(d => d.ownerId === actorId || d.versions.some(v => v.status === 'approved')).map(d => d.ownerId === actorId ? d : { ...d, workingVersion: null, versions: d.versions.filter(v => v.status === 'approved') });
      p.deliveries = p.deliveries.filter(d => d.submittedBy === actorId);
      p.audit = p.audit.filter(e => e.actorId === actorId);
      p.notifications = p.notifications.filter(n => p.deliveries.some(d => d.id === n.deliveryId));
      p.externalOperations = p.externalOperations.filter(op => op.createdBy === actorId);
      p.conversations = Object.fromEntries(Object.entries(p.conversations).filter(([taskId]) => p.tasks.some(t => t.id === taskId)));
      p.workSelections = p.workSelections?.[actorId] ? { [actorId]: p.workSelections[actorId] } : {};
      if (actorId !== p.questionnaire?.assignedTo) p.questionnaire = null;
      p.prd.content = ''; p.prd.history = []; // Draft PRD is an Admin work product.
    }
    p.documents = p.documents.map(doc => ({...doc, canEdit: documentEditAllowed(state, p, doc, actorId)}));
    if (!p.isAdmin) p.documentEditPermissions = Object.fromEntries(Object.entries(p.documentEditPermissions ?? {}).filter(([docId,grant]) => grant.userId === actorId && p.documents.some(doc => doc.id === docId && doc.ownerId === actorId)));
    delete p.documentEditEpochs; // Internal invalidation metadata is not a client capability.
    return p;
  });
  if (state.demo !== true && !canCreateProjects(state, actor)) {
    const visiblePeople = new Set([actorId, ...result.projects.flatMap(p => [...p.adminIds, ...p.team.map(t => t.personId)])]);
    result.actors = result.actors.filter(person => visiblePeople.has(person.id));
    result.people = result.people.filter(person => visiblePeople.has(person.id));
  }
  return result;
}
function answersFor(questionnaire, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) fail('INVALID_ANSWERS', 'Provide questionnaire answers as an object.');
  if (Object.keys(answers).some(key => !questionnaire.questions.some(q => q.id === key))) fail('INVALID_ANSWERS', 'Unknown questionnaire question.');
  return Object.fromEntries(questionnaire.questions.map(q => [q.id, text(answers[q.id] ?? '', q.id, { allowEmpty: true, max: 20000 })]));
}
function operationFor(project, operationId) { return project.externalOperations.find(op => op.id === operationId) ?? fail('OPERATION_NOT_FOUND', 'External preview not found.', 404); }
function providerWrite(state, project, operation, outcome = 'success') {
  if (!['success', 'failure', 'uncertain_written', 'uncertain_missing'].includes(outcome)) fail('INVALID_OUTCOME', 'Choose a supported simulation outcome.');
  operation.attempts += 1; operation.lastAttemptAt = now(); operation.checkedAbsent = false;
  const existing = state._providerReceipts.find(r => r.idempotencyKey === operation.idempotencyKey);
  if (existing) { operation.status = 'published'; operation.providerReceiptId = existing.id; return; }
  if (outcome === 'failure') { operation.status = 'failed'; operation.error = 'Simulated provider rejection; no external write occurred.'; return; }
  if (outcome === 'success' || outcome === 'uncertain_written') {
    const receipt = { id: id('sim-receipt'), idempotencyKey: operation.idempotencyKey, projectId: project.id, taskId: operation.taskId, content: operation.content, sourceVersions: clone(operation.sourceVersions), createdAt: now() };
    state._providerReceipts.push(receipt);
    if (outcome === 'success') operation.providerReceiptId = receipt.id;
  }
  operation.status = outcome.startsWith('uncertain') ? 'uncertain' : 'published'; operation.error = operation.status === 'uncertain' ? 'Simulated timeout. Check provider result before retry.' : null;
}

/** Pure, transactional state transition. The original state is never mutated. */
export function applyAction(original, action) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) fail('INVALID_ACTION', 'Provide an action object.');
  if (original.demo !== true && !action.actorId) fail('AUTH_REQUIRED', 'A verified server principal is required.', 401);
  const actorId = action.actorId ?? 'admin'; const actor = actorFor(original, actorId);
  if (action.expectedRevision !== undefined && action.expectedRevision !== original.revision) fail('STALE_STATE', 'State changed. Refresh before retrying; keep your entered text.', 409);
  const state = clone(original); let result = {}; let project;
  if (action.type === 'resetDemo') {
    if (state.demo !== true) fail('DEMO_ONLY', 'Synthetic reset is unavailable in an account workspace.', 403);
    if (actorId !== 'admin') fail('ADMIN_REQUIRED', 'Only the demo Admin can reset synthetic scenarios.', 403);
    const reset = createInitialState(action.scenario ?? 'default'); reset.revision = original.revision + 1; return { state: reset, result: { message: 'Synthetic scenario reset.' } };
  }
  if (action.type === 'createProject') {
    // Creation never inherits the convenience default persona. Require an explicit
    // global Admin selection; project/company roles and client claims do not grant it.
    if (!action.actorId || !canCreateProjects(state, actor)) fail('ADMIN_REQUIRED', 'Only a user with the global Admin capability can create projects.', 403);
    const input = action.project ?? {}; const name = text(input.name, 'Project name', { max: 200 });
    actorFor(state, input.adminId);
    if (!Array.isArray(input.team ?? [])) fail('INVALID_TEAM', 'Initial team must be an array.');
    const team = [];
    for (const entry of input.team ?? []) {
      actorFor(state, entry.personId);
      if (!Array.isArray(entry.roles)) fail('INVALID_ROLES', 'Roles must be an array.');
      const roles = [...new Set(entry.roles.map(role => text(role, 'Role', { max: 100 })))];
      if (roles.some(role => /^(admin|pm)$/i.test(role))) fail('EXPLICIT_ADMIN_REQUIRED', 'Choose the administrator in the explicit Admin field; handover rules remain open.');
      const existing = team.find(t => t.personId === entry.personId); if (existing) existing.roles = [...new Set([...existing.roles, ...roles])]; else team.push({ personId: entry.personId, roles });
    }
    const adminEntry = team.find(t => t.personId === input.adminId); if (adminEntry) adminEntry.roles.push('Admin'); else team.push({ personId: input.adminId, roles: ['Admin'] });
    project = fixtureProject(id('project')); Object.assign(project, { name, description: text(input.description ?? '', 'Description', { allowEmpty: true }), startDate: text(input.startDate ?? '', 'Start date', { allowEmpty: true, max: 100 }), endDate: text(input.endDate ?? '', 'Tentative end date', { allowEmpty: true, max: 100 }), adminIds: [input.adminId], team, tasks: [], documents: [], deliveries: [], notifications: [], audit: [], questionnaire: null, conversations: {}, externalOperations: [], prd: { version: 0, status: 'not_started', title: 'Product Requirements', content: '', requiredSourceIds: [], sourceVersions: [], history: [], fixtureRule: 'Required sources must be agreed before closure.' } });
    if (state.demo !== true) { project.connector.mode = 'not_connected'; project.connector.companyPermission = 'not_granted'; project.connector.taskMapping = 'not_configured'; project.connector.documentAccess = 'project_members_only'; }
    state.projects.push(project); audit(project, actorId, action.type, { projectId: project.id, administrator: input.adminId, validationPolicy: 'technical_minimum_only' }); result = { projectId: project.id, message: `${state.demo === true ? 'Synthetic project' : 'Project'} created. Product validation rules remain open.` };
  } else {
    project = projectFor(state, action.projectId, actorId);
    switch (action.type) {
      case 'assignRole': {
        adminOnly(state, project, actorId); actorFor(state, action.personId); const role = text(action.role, 'Role', { max: 100 });
        if (/^(admin|pm)$/i.test(role)) fail('POLICY_PENDING', 'Administrator handover needs an agreed policy.', 409);
        let entry = project.team.find(t => t.personId === action.personId); if (!entry) { entry = { personId: action.personId, roles: [] }; project.team.push(entry); }
        if (!entry.roles.includes(role)) {
          entry.roles.push(role);
          project.documentEditEpochs ??= {};
          project.documentEditEpochs[action.personId] = (project.documentEditEpochs[action.personId] ?? 0) + 1;
          for (const [docId,grant] of Object.entries(project.documentEditPermissions ?? {})) if (grant.userId === action.personId) delete project.documentEditPermissions[docId];
        }
        result = { personId: action.personId, role }; break;
      }
      case 'createTask': {
        adminOnly(state, project, actorId); const input = action.task ?? {};
        const title = text(input.title, 'Task title', { max: 200 }).trim();
        assignedPersonWithRole(state, project, input.ownerId, role => SPECIALIST_ROLES.has(role), 'specialist');
        if (!Array.isArray(input.documentTitles) || input.documentTitles.length < 1 || input.documentTitles.length > 10) fail('DOCUMENT_TITLES_REQUIRED', 'Provide between one and ten explicit document titles.');
        const titles = input.documentTitles.map(value => text(value, 'Document title', { max: 200 }).trim());
        const taskId = id('task'); const documentIds = titles.map(() => id('document')); const timestamp = now();
        project.tasks.push({ id: taskId, title, ownerId: input.ownerId, documentIds, status: 'available', completedAt: null, linkedTaskId: null, createdBy: actorId, createdAt: timestamp });
        titles.forEach((documentTitle, index) => project.documents.push({ id: documentIds[index], title: documentTitle, ownerId: input.ownerId, taskId, workingVersion: 1, versions: [{ version: 1, content: '', status: 'draft', savedAt: timestamp }] }));
        result = { taskId, documentIds, ownerId: input.ownerId, status: 'available' }; break;
      }
      case 'setRequiredSources': {
        adminOnly(state, project, actorId);
        if (!Array.isArray(action.documentIds) || action.documentIds.some(value => typeof value !== 'string') || new Set(action.documentIds).size !== action.documentIds.length) fail('INVALID_SOURCE_SELECTION', 'Choose a distinct explicit list of source documents.');
        action.documentIds.forEach(documentId => documentFor(project, documentId));
        const previous = [...project.prd.requiredSourceIds].sort(); const next = [...action.documentIds].sort();
        const changed = JSON.stringify(previous) !== JSON.stringify(next);
        if (changed) {
          project.prd.requiredSourceIds = [...action.documentIds];
          project.prd.sourceSelectionVersion = (project.prd.sourceSelectionVersion ?? 0) + 1;
          project.prd.sourcesSelectedBy = actorId; project.prd.sourcesSelectedAt = now();
          project.prd.fixtureRule = 'Applicable required sources were explicitly selected by the project Admin. This selection is not a universal source rule.';
        }
        result = { requiredSourceIds: [...project.prd.requiredSourceIds], changed, requiresPreparation: changed && project.prd.version > 0, readiness: readiness(project) }; break;
      }
      case 'assignQuestionnaire': {
        adminOnly(state, project, actorId);
        if (project.questionnaire) fail('POLICY_PENDING', 'A questionnaire is already assigned. Reassignment and clarification policy must be agreed before changing it.', 409);
        assignedPersonWithRole(state, project, action.personId, role => role === 'stakeholder', 'Stakeholder');
        project.questionnaire = { assignedTo: action.personId, assignedBy: actorId, assignedAt: now(), questions: QUESTIONS.map((question, i) => ({ id: `q${i + 1}`, text: question, optional: true })), answers: Object.fromEntries(QUESTIONS.map((_, i) => [`q${i + 1}`, ''])), status: 'draft', savedAt: now(), submissions: [], questionWording: 'Provisional shared template; exact source wording and results mapping still require verification.' };
        result = { assignedTo: action.personId, questionCount: 10, status: 'draft' }; break;
      }
      case 'removeRole': case 'replaceRole': case 'transferTask':
        adminOnly(state, project, actorId); fail('POLICY_PENDING', 'Role removal, replacement and task handover are blocked until product policy is defined.', 409); break;
      case 'setDocumentEditPermission': {
        adminOnly(state, project, actorId);
        if (Object.keys(action).some(key => !['type','projectId','documentId','allowEdit','actorId','requestId','expectedRevision'].includes(key)) || typeof action.allowEdit !== 'boolean') fail('INVALID_EDIT_PERMISSION', 'Specify one document and an explicit allowEdit boolean.');
        const doc = documentFor(project, action.documentId);
        const owner = actorFor(state, doc.ownerId);
        if (!member(project, owner.id) || owner.identityVerified !== true || owner.accountStatus !== 'active') fail('EDIT_PERMISSION_OWNER_UNAVAILABLE', 'The document owner must be an active verified project member.', 403);
        if (action.allowEdit && (!Number.isSafeInteger(owner.accessVersion) || owner.accessVersion < 1)) fail('EDIT_PERMISSION_EPOCH_UNAVAILABLE', 'Verified account access version is required before granting editing.', 409);
        if (action.allowEdit && !readOnlyStakeholder(state, owner.id)) fail('EDIT_PERMISSION_NOT_APPLICABLE', 'This exception applies only to a current read-only Stakeholder owner.', 409);
        project.documentEditPermissions ??= {};
        if (action.allowEdit) project.documentEditPermissions[doc.id] = {userId:doc.ownerId,allowed:true,ownerAccessVersion:owner.accessVersion,projectRoleEpoch:project.documentEditEpochs?.[doc.ownerId] ?? 0,grantedBy:actorId,grantedAt:now()};
        else delete project.documentEditPermissions[doc.id];
        result = {documentId:doc.id,ownerId:doc.ownerId,allowEdit:action.allowEdit};
        break;
      }
      case 'readNotice': {
        const notice = project.notifications.find(n => n.id === action.noticeId) ?? fail('NOTICE_NOT_FOUND', 'Notice not found.', 404);
        if (!isProjectAdmin(state, project, actorId) && !project.deliveries.some(delivery => delivery.id === notice.deliveryId && delivery.submittedBy === actorId)) fail('NOTICE_ACCESS_DENIED', 'This notice is not visible to your current project access.', 403);
        if (!notice.readBy.includes(actorId)) notice.readBy.push(actorId); result = { deliveryId: notice.deliveryId }; break;
      }
      case 'openReview': case 'approveDelivery': case 'returnDelivery': {
        adminOnly(state, project, actorId); const delivery = deliveryFor(project, action.deliveryId);
        if (!['submitted', 'under_review'].includes(delivery.status)) fail('INVALID_STATE', 'This delivery is no longer awaiting review.', 409);
        if (action.type === 'openReview') { delivery.status = 'under_review'; delivery.reviewStartedAt ??= now(); }
        else {
          const reason = action.type === 'returnDelivery' ? text(action.reason, 'Change-request reason', { max: 20000 }).trim() : '';
          delivery.status = action.type === 'approveDelivery' ? 'approved' : 'returned'; delivery.reviewedBy = actorId; delivery.reviewedAt = now(); delivery.feedback = reason;
          for (const snapshot of delivery.documentVersions) {
            const doc = documentFor(project, snapshot.documentId); const version = doc.versions.find(v => v.version === snapshot.version);
            if (!version || version.content !== snapshot.content || !['submitted', 'under_review'].includes(version.status)) fail('SNAPSHOT_MISMATCH', 'Submitted source no longer matches the immutable package.', 409);
            version.status = delivery.status;
            if (delivery.status === 'approved') { version.approvedBy = actorId; version.approvedAt = now(); doc.workingVersion = null; }
            else { version.returnReason = reason; const next = Math.max(...doc.versions.map(v => v.version)) + 1; doc.workingVersion = next; doc.versions.push({ version: next, content: snapshot.content, status: 'draft', savedAt: now(), returnedFrom: snapshot.version, returnReason: reason }); }
          }
        }
        delivery.history.push({ action: action.type, actorId, at: now(), ...(delivery.feedback ? { reason: delivery.feedback } : {}) });
        result = { deliveryId: delivery.id, version: delivery.version, status: delivery.status }; break;
      }
      case 'saveDraft': {
        const doc = ownDocument(state, project, action.documentId, actorId); const version = doc.versions.find(v => v.version === doc.workingVersion);
        if (!version || version.status !== 'draft') fail('DOCUMENT_LOCKED', 'Submitted and approved versions are read-only. Start a new working version when eligible.', 409);
        version.content = text(action.content, 'Draft content', { allowEmpty: true }); version.savedAt = now(); result = { documentId: doc.id, version: version.version, savedAt: version.savedAt }; break;
      }
      case 'beginRevision': {
        const doc = ownDocument(state, project, action.documentId, actorId); const latest = doc.versions.at(-1);
        if (doc.workingVersion !== null || latest.status !== 'approved') fail('INVALID_STATE', 'A new revision can start from an approved version only.', 409);
        const version = latest.version + 1; doc.versions.push({ version, content: latest.content, status: 'draft', savedAt: now(), basedOn: latest.version }); doc.workingVersion = version; result = { documentId: doc.id, version }; break;
      }
      case 'submitDocuments': {
        if (!Array.isArray(action.documentIds) || action.documentIds.length === 0 || new Set(action.documentIds).size !== action.documentIds.length) fail('SELECT_DOCUMENTS', 'Select one or more distinct saved working documents.');
        const docs = action.documentIds.map(docId => ownDocument(state, project, docId, actorId));
        if (new Set(docs.map(d => d.taskId)).size !== 1) fail('TASK_SCOPE_REQUIRED', 'Submit documents from one task at a time in this evaluation build.');
        const versions = docs.map(doc => doc.versions.find(v => v.version === doc.workingVersion));
        if (versions.some(v => !v || v.status !== 'draft')) fail('DOCUMENT_LOCKED', 'Only saved working drafts may be submitted.', 409);
        const delivery = { id: id('delivery'), version: Math.max(...versions.map(v => v.version)), status: 'submitted', documentVersions: docs.map((doc, i) => documentSnapshot(doc, versions[i])), excludedDocumentIds: project.documents.filter(d => d.taskId === docs[0].taskId && !action.documentIds.includes(d.id)).map(d => d.id), submittedBy: actorId, submittedAt: now(), reviewedBy: null, feedback: '', history: [{ action: 'submitted', actorId, at: now() }] };
        docs.forEach((doc, i) => { versions[i].status = 'submitted'; doc.workingVersion = null; }); project.deliveries.push(delivery); project.notifications.push({ id: id('notice'), deliveryId: delivery.id, title: `New delivery v${delivery.version}`, readBy: [], createdAt: now() }); result = { deliveryId: delivery.id, version: delivery.version, documentVersions: clone(delivery.documentVersions) }; break;
      }
      case 'completeTask': {
        const task = taskFor(project, action.taskId); if (task.ownerId !== actorId) fail('OWNER_REQUIRED', 'Only the assigned specialist may declare this task complete.', 403);
        if (action.acknowledgeDemoRule !== true) fail('POLICY_ACKNOWLEDGEMENT_REQUIRED', 'Completion eligibility is undecided. Explicitly acknowledge this manual demo declaration; it does not submit or approve documents.', 409);
        task.status = 'complete'; task.completedAt = now(); task.completionPolicy = 'manual_demo_declaration'; result = { taskId: task.id, message: 'Task completion recorded separately from document submission and approval.' }; break;
      }
      case 'selectTasks': case 'activateTask': {
        const taskIds = action.type === 'activateTask' ? [action.taskId] : action.taskIds;
        if (!Array.isArray(taskIds) || !taskIds.length || new Set(taskIds).size !== taskIds.length) fail('SELECT_TASKS', 'Choose one or more distinct applicable tasks.');
        const tasks = taskIds.map(taskId => taskFor(project, taskId));
        if (tasks.some(task => task.ownerId !== actorId) || actorId === project.questionnaire?.assignedTo) fail('OWNER_REQUIRED', 'Work selection is only for an assigned specialist. Stakeholders enter their questionnaire directly.', 403);
        for (const task of tasks) { if (task.status !== 'complete') task.status = 'active'; task.activatedAt ??= now(); }
        project.workSelections ??= {}; const earlier = project.workSelections[actorId]?.selectedTaskIds ?? [];
        project.workSelections[actorId] = { selectedTaskIds: [...new Set([...earlier, ...taskIds])], selectedAt: now(), firstEntryComplete: true };
        result = { taskIds, selection: clone(project.workSelections[actorId]) }; break;
      }
      case 'preparePrd': {
        adminOnly(state, project, actorId); if (!project.prd.requiredSourceIds.length) fail('POLICY_PENDING', 'Agree this project’s applicable required sources before preparing a PRD.', 409);
        if (project.prd.version) project.prd.history.push(clone({ ...project.prd, requiredSourceIds: project.prd.preparedRequiredSourceIds ?? project.prd.sourceVersions.map(source => source.documentId), sourceSelectionVersion: project.prd.preparedSelectionVersion ?? 0, history: undefined }));
        project.prd.version += 1; project.prd.status = 'draft'; project.prd.sourceVersions = currentSources(project); project.prd.content = makePrdContent(project, state.demo === true); project.prd.preparedAt = now(); project.prd.preparedBy = actorId; project.prd.preparedRequiredSourceIds = [...project.prd.requiredSourceIds]; project.prd.preparedSelectionVersion = project.prd.sourceSelectionVersion ?? 0; delete project.prd.closedAt; delete project.prd.closedBy;
        result = { version: project.prd.version, readiness: readiness(project) }; break;
      }
      case 'closePrd': {
        adminOnly(state, project, actorId); if (project.prd.status !== 'draft' || action.prdVersion !== project.prd.version) fail('PRD_VERSION_MISMATCH', 'Review the exact current PRD draft before closing.', 409);
        if (!Array.isArray(action.sourceVersions) || sourceKey(action.sourceVersions) !== sourceKey(project.prd.sourceVersions)) fail('SOURCE_CONFIRMATION_REQUIRED', 'Confirm the exact source versions displayed for this PRD.', 409);
        const ready = readiness(project); if (ready.changedSources) fail('SOURCES_CHANGED', 'Sources changed after preparation. Prepare and review a fresh PRD draft.', 409, ready);
        if (!ready.ready) fail('SOURCES_INCOMPLETE', 'All applicable source versions must be approved before closure.', 409, ready);
        project.prd.status = 'closed'; project.prd.closedBy = actorId; project.prd.closedAt = now(); result = { version: project.prd.version, sourceVersions: clone(project.prd.sourceVersions), closedBy: actorId, closedAt: project.prd.closedAt }; break;
      }
      case 'saveQuestionnaire': case 'submitQuestionnaire': {
        const q = project.questionnaire; if (!q || q.assignedTo !== actorId) fail('QUESTIONNAIRE_ACCESS_DENIED', 'Only the assigned Stakeholder can save or submit these answers.', 403);
        if (q.status === 'submitted') fail('QUESTIONNAIRE_LOCKED', 'Submitted responses are read-only. Clarification-return behavior remains open.', 409);
        const answers = answersFor(q, action.answers); const pending = q.questions.filter(question => !answers[question.id].trim()).map(question => question.id);
        if (action.type === 'submitQuestionnaire' && pending.length && action.confirmAvailable !== true) fail('CONFIRM_PENDING_ANSWERS', `${pending.length} optional answers remain pending.`, 409, { pending, choices: ['return_to_complete', 'save_for_later', 'submit_available'] });
        q.answers = answers; q.savedAt = now();
        if (action.type === 'submitQuestionnaire') { q.status = 'submitted'; q.submittedAt = now(); q.submissions.push({ id: id('responses'), answers: clone(answers), pending, submittedAt: q.submittedAt, submittedBy: actorId }); }
        result = { status: q.status, answered: q.questions.length - pending.length, pending }; break;
      }
      case 'simulateAi': {
        if (state.demo !== true) fail('DEMO_ONLY', 'AI simulation is unavailable in account workspaces.', 403);
        const task = taskFor(project, action.taskId); if (task.ownerId !== actorId) fail('OWNER_REQUIRED', 'Open an assigned task to use its assistant.', 403);
        const message = text(action.message, 'Message', { max: 20000 });
        const suggestion = `Simulation for ${task.title}\n\nYour request: ${message}\n\nProposed working outline:\n1. State the problem and intended user outcome.\n2. Separate supplied evidence from assumptions.\n3. Record open questions and next validation steps.\n\nThis is a deterministic local suggestion, not a live AI response or verified research. Review and edit before using it.`;
        const history = project.conversations[task.id] ??= []; history.push({ id: id('message'), role: 'user', content: message, at: now() }, { id: id('message'), role: 'assistant', content: suggestion, mode: 'simulation', at: now() });
        result = { mode: 'simulation', suggestion, taskId: task.id }; break;
      }
      case 'previewExternal': {
        adminOnly(state, project, actorId); const task = taskFor(project, action.taskId);
        if (!task.linkedTaskId) fail('TASK_NOT_LINKED', 'This task has no approved external mapping. Configure the destination before preparing an external update.', 409);
        if (!['comment', 'approvedUpdate'].includes(action.kind)) fail('INVALID_KIND', 'Choose a task comment or approved-version update.');
        let sources = []; let approvedLink = null;
        if (action.kind === 'approvedUpdate') {
          const delivery = deliveryFor(project, action.deliveryId); if (delivery.status !== 'approved') fail('APPROVAL_REQUIRED', 'An approved exact delivery is required for a document update.', 409);
          if (delivery.documentVersions.some(s => documentFor(project, s.documentId).taskId !== task.id)) fail('TARGET_MISMATCH', 'The linked task must match every document in the approved delivery.', 409);
          sources = delivery.documentVersions.map(({ documentId, version }) => ({ documentId, version })); approvedLink = `/projects/${project.id}/deliveries/${delivery.id}`;
        }
        const operation = { id: id('external'), idempotencyKey: id('request'), kind: action.kind, provider: project.connector.provider, mode: 'simulation', projectId: project.id, taskId: task.id, linkedTaskId: task.linkedTaskId, deliveryId: action.deliveryId ?? null, sourceVersions: sources, approvedLink, content: text(action.content, 'External content', { max: 20000 }), status: 'pending', authorized: false, createdBy: actorId, createdAt: now(), attempts: 0, checkedAbsent: false, documentAccess: 'Local simulation link only. External access policy is unresolved.' };
        project.externalOperations.push(operation); result = { operation: clone(operation), operationId: operation.id }; break;
      }
      case 'publishExternal': case 'checkExternal': case 'retryExternal': {
        adminOnly(state, project, actorId); const operation = operationFor(project, action.operationId);
        if (operation.status === 'published') { result = { operationId: operation.id, status: operation.status, duplicatePrevented: true }; break; }
        if (action.type === 'checkExternal') {
          if (operation.status !== 'uncertain') fail('INVALID_STATE', 'Only uncertain provider outcomes need reconciliation.', 409);
          const receipt = state._providerReceipts.find(r => r.idempotencyKey === operation.idempotencyKey); operation.checkedAt = now();
          if (receipt) { operation.status = 'published'; operation.providerReceiptId = receipt.id; operation.error = null; }
          else { operation.status = 'failed'; operation.checkedAbsent = true; operation.error = 'Simulation check confirms no provider write. Safe to retry the same operation.'; }
        } else if (action.type === 'publishExternal') {
          if (operation.status !== 'pending') fail('USE_RETRY_FLOW', 'Use the checked recovery flow for a previous attempt.', 409);
          if (action.authorized !== true) fail('PUBLICATION_AUTHORIZATION_REQUIRED', 'Separately authorize this exact preview, destination and content before simulated publication.', 409);
          operation.authorized = true; operation.authorizedBy = actorId; operation.authorizedAt = now(); providerWrite(state, project, operation, action.outcome);
        } else {
          if (operation.status === 'uncertain') fail('CHECK_BEFORE_RETRY', 'Check the provider outcome before retrying an uncertain write.', 409);
          if (operation.status !== 'failed' || !operation.authorized) fail('INVALID_STATE', 'Only an authorized failed operation can be retried.', 409);
          providerWrite(state, project, operation, action.outcome);
        }
        result = { operationId: operation.id, status: operation.status, attempts: operation.attempts }; break;
      }
      case 'configureConnector':
        if (!actor.companyIntegrationAdmin) fail('COMPANY_ADMIN_REQUIRED', 'Project Admin does not grant company integration administration.', 403);
        fail('LIVE_CONNECTOR_UNAVAILABLE', 'No live connector configuration exists in this local simulation.', 409); break;
      default: fail('UNKNOWN_ACTION', 'Unknown action type.');
    }
    audit(project, actorId, action.type, result);
  }
  state.revision += 1; return { state, result };
}
