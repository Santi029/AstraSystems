import test from 'node:test';import assert from 'node:assert/strict';
import {createInitialState,applyAction,viewState} from '../fixtures/domain-v6.mjs';
function fixture(){let s=createInitialState();s.demo=false;s.actors=s.actors.map(a=>({...a,globalRoles:[a.id==='admin'?'Admin':a.id==='stakeholder'?'Stakeholder':'QA'],identityVerified:true,accountStatus:'active',accessVersion:1}));s.people=structuredClone(s.actors);return s;}
const run=(s,actorId,type,payload)=>applyAction(s,{actorId,type,projectId:'atlas',...payload}).state;
test('returned revision preserves prior delivery and feedback through correction and resubmission',()=>{
 let s=fixture();const original=structuredClone(s.projects[0].deliveries[0].documentVersions);
 s=run(s,'admin','returnDelivery',{deliveryId:'delivery-v3',reason:'Clarify evidence sources.'});
 const returned=structuredClone(s.projects[0].deliveries[0]);
 const d=s.projects[0].documents.find(d=>d.id==='research');assert.equal(d.workingVersion,4);assert.equal(d.versions.at(-1).returnReason,'Clarify evidence sources.');
 assert.equal(viewState(s,'specialist').projects[0].documents.find(d=>d.id==='research').canEdit,true);
 s=run(s,'specialist','saveDraft',{documentId:'research',content:'Revised evidence.'});
 s=run(s,'specialist','submitDocuments',{documentIds:['research']});
 assert.deepEqual(s.projects[0].deliveries[0],returned);assert.deepEqual(s.projects[0].deliveries[0].documentVersions,original);
 assert.equal(s.projects[0].deliveries.at(-1).documentVersions[0].version,4);
 assert.equal(s.projects[0].deliveries.at(-1).documentVersions[0].content,'Revised evidence.');
 assert.equal(s.projects[0].documents.find(d=>d.id==='goals').workingVersion,4);
 assert.throws(()=>run(s,'specialist','saveDraft',{documentId:'research',content:'overwrite'}),e=>e.code==='DOCUMENT_LOCKED');
});
test('return creates no implicit editing grant after owner becomes Stakeholder-only',()=>{
 let s=fixture();s.actors.find(a=>a.id==='specialist').globalRoles=['Stakeholder'];s.actors.find(a=>a.id==='specialist').accessVersion=2;s.people=structuredClone(s.actors);
 s=run(s,'admin','returnDelivery',{deliveryId:'delivery-v3',reason:'Clarify evidence sources.'});
 assert.equal(viewState(s,'specialist').projects[0].documents.find(d=>d.id==='research').canEdit,false);
 for(const [type,payload] of [['saveDraft',{documentId:'research',content:'blocked'}],['submitDocuments',{documentIds:['research']}]] ) assert.throws(()=>run(s,'specialist',type,payload),e=>e.code==='DOCUMENT_READ_ONLY');
 assert.equal(s.projects[0].documentEditPermissions?.research,undefined);
});
