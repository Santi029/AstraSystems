import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../server/index.mjs';
import { createInitialState, viewState, applyAction } from '../fixtures/domain-v6.mjs';
const app=await startServer({production:true,authMode:'accounts',port:0,loopbackOnly:true});
const browser=await chromium.launch({headless:true,...(process.env.ASTRA_TEST_CHROMIUM ? {executablePath:process.env.ASTRA_TEST_CHROMIUM} : {})});
const results=[], errors=[];
await mkdir('specialist-revision-results',{recursive:true});
try {
 async function scenario(actor,width=1280,demoted=false) {
  let state=createInitialState(), actions=[];
  state.demo=false;state.actors=state.actors.map(a=>({...a,globalRoles:[a.id==='admin'?'Admin':a.id==='stakeholder'||(a.id===actor&&demoted)?'Stakeholder':'QA'],identityVerified:true,accountStatus:'active',accessVersion:demoted?2:1}));state.people=structuredClone(state.actors);
  state=applyAction(state,{actorId:'admin',type:'returnDelivery',projectId:'atlas',deliveryId:'delivery-v3',reason:'Clarify evidence sources.'}).state;
  const context=await browser.newContext({viewport:{width,height:900}});
  const dto=()=>{const v=viewState(state,actor);v.demo=false;v.currentActor={...v.currentActor,identityVerified:true,accountStatus:'active',status:'active'};return v;};
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==app.url) { errors.push('external request');return route.abort(); }
   if(!url.pathname.startsWith('/api/')) return route.continue();
   let body,status=200;
   if(url.pathname==='/api/auth/status')body={ok:true,mode:'accounts',configured:true,authenticated:true,csrfToken:'synthetic-csrf',user:{id:actor,email:actor+'@example.invalid'}};
   else if(url.pathname==='/api/state')body={ok:true,state:dto()};
   else if(url.pathname==='/api/action'){
    const a=route.request().postDataJSON();actions.push(a);
    assert.equal(route.request().headers()['x-astra-csrf'],'synthetic-csrf');
    assert.equal(a.actorId,undefined);assert.match(a.requestId,/^[a-f0-9-]{36}$/);
    try {const r=applyAction(state,{...a,actorId:actor});state=r.state;body={ok:true,result:r.result,state:dto()};}
    catch(e){status=e.status||400;body={ok:false,error:{code:e.code,message:e.message}};}
   } else {errors.push('unexpected API '+url.pathname);status=404;body={ok:false};}
   return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {context,page,actions,getState:()=>state};
 }
 for(const width of [1280,390]) {
  const h=await scenario('specialist',width);const returned=structuredClone(h.getState().projects[0].deliveries[0]);
  await h.page.goto(app.url+'/#project/atlas/document/research');
  await expect(h.page.getByRole('heading',{name:'Requested changes'})).toBeVisible();
  await expect(h.page.getByText('Clarify evidence sources.',{exact:true})).toBeVisible();
  await h.page.getByLabel('Document content',{exact:true}).fill('Revised evidence from synthetic specialist.');
  await h.page.getByRole('button',{name:'Save & next'}).click();
  await expect(h.page.getByRole('heading',{name:'Review your submission'})).toBeVisible();
  await h.page.getByRole('checkbox').first().check();
  await h.page.getByRole('button',{name:'Submit selected',exact:true}).click();
  await h.page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await expect(h.page.getByText('Selected versions submitted. The package is now read-only.')).toBeVisible();
  const p=h.getState().projects[0];assert.deepEqual(p.deliveries[0],returned);assert.equal(p.deliveries.at(-1).documentVersions[0].version,4);assert.equal(p.deliveries.at(-1).documentVersions[0].content,'Revised evidence from synthetic specialist.');
  assert.equal(p.documents.find(d=>d.id==='goals').workingVersion,4);
  assert.deepEqual(h.actions.map(a=>a.type),['saveDraft','submitDocuments']);
  await h.page.goto(app.url+'/#project/atlas/document/research');await expect(h.page.getByLabel('Document content',{exact:true})).toHaveAttribute('readonly','');
  await h.page.screenshot({path:`specialist-revision-results/resubmitted-${width}.png`,fullPage:true});
  results.push({check:`returned revision ${width}: feedback, save, explicit resubmit, original snapshot preserved`,pass:true});await h.context.close();
 }
 {
  const h=await scenario('specialist',390,true);await h.page.goto(app.url+'/#project/atlas/document/research');
  await expect(h.page.getByRole('heading',{name:'Requested changes'})).toBeVisible();
  await expect(h.page.getByLabel('Document content',{exact:true})).toHaveAttribute('readonly','');
  await expect(h.page.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);assert.equal(h.actions.length,0);
  results.push({check:'returned document remains readonly after Stakeholder-only demotion; no implicit grant',pass:true});await h.context.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile('specialist-revision-results/results.json',JSON.stringify({results,errors,synthetic:true},null,2));console.log(JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(r=>app.server.close(r));}
