import test from 'node:test';
import assert from 'node:assert/strict';
import {specialistOpenTarget} from '../src/specialist-work-model.ts';
import {readFileSync} from 'node:fs';
import {buildSync} from 'esbuild';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const state=()=>({currentActor:{id:'a',identityVerified:true,accountStatus:'active'},projects:[{id:'p',tasks:[{id:'t',ownerId:'a',title:'Assigned task'}],workSelections:{a:{selectedTaskIds:['t']}},documents:[{id:'d',ownerId:'a',taskId:'t',title:'Document'}]}]});
test('one owned selected task resolves document, pure and no new permission',()=>{const s=state(),before=structuredClone(s);assert.deepEqual(specialistOpenTarget(s,'p','a','t').documents.map(d=>d.id),['d']);assert.deepEqual(s,before)});
test('changed actor, inactive identity, assignment removal and selection removal fail closed',()=>{for(const mutate of [s=>s.currentActor.id='b',s=>s.currentActor.accountStatus='removed',s=>s.projects[0].tasks[0].ownerId='b',s=>s.projects[0].workSelections.a.selectedTaskIds=[]]){const s=state();mutate(s);assert.equal(specialistOpenTarget(s,'p','a','t').ok,false)}});
test('duplicate task ids do not open; duplicate document ids cannot be selected',()=>{const s=state();s.projects[0].tasks.push({...s.projects[0].tasks[0]});assert.equal(specialistOpenTarget(s,'p','a','t').ok,false);s.projects[0].tasks.pop();s.projects[0].documents.push({...s.projects[0].documents[0]});assert.deepEqual(specialistOpenTarget(s,'p','a','t').documents,[])});
test('multiple documents remain explicit alternatives, foreign documents are excluded',()=>{const s=state();s.projects[0].documents.push({id:'d2',ownerId:'a',taskId:'t'},{id:'foreign',ownerId:'b',taskId:'t'});assert.deepEqual(specialistOpenTarget(s,'p','a','t').documents.map(d=>d.id),['d','d2'])});
test('zero documents differs from unavailable dataset',()=>{const s=state();s.projects[0].documents=[];assert.deepEqual(specialistOpenTarget(s,'p','a','t').documents,[]);delete s.projects[0].documents;assert.equal(specialistOpenTarget(s,'p','a','t').ok,false)});
const filename=fileURLToPath(new URL('./specialist.fixture.cjs',import.meta.url));
const require=createRequire(import.meta.url),mod=new Module(filename);mod.filename=filename;mod.paths=require.resolve.paths('react');mod.require=require;
const source=readFileSync(new URL('../src/SpecialistMyTasks.tsx',import.meta.url),'utf8');
const compiled=buildSync({stdin:{contents:source,resolveDir:fileURLToPath(new URL('../src',import.meta.url)),loader:'tsx'},jsx:'automatic',bundle:true,write:false,platform:'node',format:'cjs',external:['react'],loader:{'.css':'empty'}}).outputFiles[0].text;mod._compile(compiled,filename);
test('assigned-work renders owned table with no creation controls, AI claims or fictitious recommendations',()=>{const s=state();s.projects[0].tasks.push({id:'foreign',ownerId:'b',title:'PRIVATE OTHER'});const html=renderToStaticMarkup(React.createElement(mod.exports.SpecialistMyTasks,{p:s.projects[0],actorId:'a',personName:id=>id,mode:'assigned-work',onOpenTask:()=>{}}));assert.match(html,/Assigned task/);assert.match(html,/Search my tasks/);assert.doesNotMatch(html,/<form|Custom task name|AI Recommended Tasks|Task 1|Add Selected Tasks|PRIVATE OTHER/)});
test('route integration retains explicit selection, submission and latest-state document revalidation',()=>{const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');assert.match(main,/mode="assigned-work"/);assert.match(main,/Activate selected work/);assert.match(main,/Review submission/);assert.match(main,/specialistOpenTarget\(stateRef.current, p.id, actor, taskId\)/);assert.match(main,/section === "task"/);assert.match(main,/No document assigned/)});

test('malformed selection cannot act as substring membership or a permissive includes object',()=>{
  for(const ids of ['not-this-task', null, {}, {includes:()=>true}, ['t', 't'], ['t', null], [42], ['not-this-task']]){
    const s=state();s.projects[0].workSelections.a.selectedTaskIds=ids;
    assert.equal(specialistOpenTarget(s,'p','a','t').ok,false);
  }
});
test('malformed or duplicate project entries fail closed without throwing',()=>{
  for(const extra of [null, undefined, 'not-project', 42, []]){const s=state();s.projects.unshift(extra);assert.equal(specialistOpenTarget(s,'p','a','t').ok,false)}
  const s=state();s.projects.push(structuredClone(s.projects[0]));assert.equal(specialistOpenTarget(s,'p','a','t').ok,false);
});
