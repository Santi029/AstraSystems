import test from 'node:test';
import assert from 'node:assert/strict';
import { specialistAssignedTasks, specialistSelection } from '../src/specialist-work-model.ts';
import { createBackendContract } from '../src/backend-contract.ts';
import { applyAction, createInitialState, viewState } from '../server/domain.mjs';
const person = { id: 's', identityVerified: true, accountStatus: 'active', globalRoles: ['QA'] };
const fixture = () => ({ demo: false, currentActor: person, projects: [{ id: 'p', tasks: [{ id: 'own', ownerId: 's' }, { id: 'other', ownerId: 'x' }], questionnaire: { assignedTo: 'stakeholder' } }] });
test('owned Specialist selection uses the existing active selectTasks contract', () => {
 const state = fixture(), result = specialistSelection(state, 'p', 's', ['own']);
 assert.equal(result.ok,true);
 assert.equal(createBackendContract().guardAction('selectTasks',result.payload).ok,true);
 assert.deepEqual(result.payload,{projectId:'p',taskIds:['own']});
 assert.deepEqual(specialistAssignedTasks(state.projects[0],'s').map(t=>t.id),['own']);
});
test('foreign, stale, missing, duplicate, unverified and stakeholder selections fail closed', () => {
 for (const ids of [[],['other'],['own','own'],['missing'],['own',null]]) assert.equal(specialistSelection(fixture(),'p','s',ids).ok,false);
 for (const change of [s=>s.currentActor.identityVerified=false,s=>s.currentActor.accountStatus='suspended',s=>s.projects[0].questionnaire.assignedTo='s',s=>s.projects[0].tasks[0].ownerId='x']) {
  const s=structuredClone(fixture());change(s);assert.equal(specialistSelection(s,'p','s',['own']).ok,false);
 }
 assert.equal(specialistSelection(fixture(),'p','forged',['own']).ok,false);
 assert.equal(specialistSelection(fixture(),'missing','s',['own']).ok,false);
});
test('Admin role alone does not fabricate Specialist work', () => {
 const s=fixture();s.currentActor={...person,id:'admin',globalRoles:['Admin']};
 assert.equal(specialistSelection(s,'p','admin',['own']).ok,false);
});
test('synthetic server transition activates owned work without completion or delivery', () => {
 const state=createInitialState(), dto=viewState(state,'specialist'), project=dto.projects[0];
 const tasks=specialistAssignedTasks(project,'specialist');assert.ok(tasks.length);
 const selected=specialistSelection(dto,project.id,'specialist',[tasks[0].id]);assert.equal(selected.ok,true);
 const original=state.projects.find(p=>p.id===project.id);
 const result=applyAction(state,{type:'selectTasks',actorId:'specialist',...selected.payload});
 const next=result.state.projects.find(p=>p.id===project.id);
 assert.equal(next.tasks.find(t=>t.id===tasks[0].id).status,'active');
 assert.deepEqual(next.deliveries,original.deliveries);
 assert.deepEqual(next.documents,original.documents);
 assert.equal(next.workSelections.specialist.firstEntryComplete,true);
 assert.throws(()=>applyAction(state,{type:'selectTasks',actorId:'stakeholder',...selected.payload}), e=>e.code==='OWNER_REQUIRED');
});

test('draft and submission guard rejects changed versions, foreign ownership and mixed tasks', async () => {
 const {specialistDocumentAction:guard}=await import('../src/specialist-work-model.ts');
 const state=fixture();state.projects[0].documents=[{id:'d',taskId:'own',ownerId:'s',workingVersion:1,versions:[{version:1,status:'draft'}]}];
 assert.equal(guard(state,'p','s',['d'],{d:1}).ok,true);
 assert.equal(guard(state,'p','s',['d'],{d:2}).ok,false);
 assert.equal(guard(state,'p','s',['d','d'],{d:1}).ok,false);
 state.projects[0].tasks.push({id:'own2',ownerId:'s'});state.projects[0].documents.push({id:'d2',taskId:'own2',ownerId:'s',workingVersion:1,versions:[{version:1,status:'draft'}]});assert.equal(guard(state,'p','s',['d','d2'],{d:1,d2:1}).ok,false);
 state.projects[0].documents[0].versions[0].status='submitted';assert.equal(guard(state,'p','s',['d'],{d:1}).ok,false);
 state.projects[0].documents[0].versions[0].status='draft';state.projects[0].documents[0].ownerId='x';assert.equal(guard(state,'p','s',['d'],{d:1}).ok,false);
});
