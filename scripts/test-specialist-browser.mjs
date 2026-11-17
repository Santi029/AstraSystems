import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../server/index.mjs';
import { createInitialState, viewState, applyAction } from '../server/domain.mjs';
const app=await startServer({production:true,authMode:'accounts',port:0,loopbackOnly:true});
const browser=await chromium.launch({headless:true,...(process.env.ASTRA_TEST_CHROMIUM ? {executablePath:process.env.ASTRA_TEST_CHROMIUM} : {})});
const results=[], errors=[];
await mkdir('specialist-browser-results',{recursive:true});
try {
 async function scenario(actor,width=1280) {
  let state=createInitialState(), actions=[];
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
 for(const width of [1280,390]){
  const h=await scenario('specialist',width);
  await h.page.goto(app.url+'/#project/atlas/select');
  await expect(h.page.getByRole('heading',{name:'Select your work'})).toBeVisible();
  const boxes=h.page.getByRole('checkbox');assert.ok(await boxes.count()>0);
  const submit=h.page.getByRole('button',{name:'Activate selected work'});await expect(submit).toBeDisabled();
  await boxes.first().focus();await h.page.keyboard.press('Space');await expect(boxes.first()).toBeChecked();
  await expect(submit).toBeEnabled();
  for(let i=0;i<25 && !(await submit.evaluate(el=>el===document.activeElement));i++) await h.page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await h.page.screenshot({path:`specialist-browser-results/select-keyboard-${width}.png`,fullPage:true});
  await h.page.keyboard.press('Enter');
  await expect(h.page.getByRole('heading',{name:'My tasks',exact:true})).toBeVisible();
  assert.equal(h.actions.length,1);assert.equal(h.actions[0].type,'selectTasks');
  const p=h.getState().projects.find(p=>p.id==='atlas');assert.equal(p.workSelections.specialist.selectedTaskIds.length,1);
  await h.page.screenshot({path:`specialist-browser-results/selected-${width}.png`,fullPage:true});
  const overflow=await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);
  await expect(h.page.getByLabel('Custom task name',{exact:true})).toHaveCount(0);
  const selectedTask=p.tasks.find(t=>t.id===p.workSelections.specialist.selectedTaskIds[0]);
  const docs=p.documents.filter(d=>d.taskId===selectedTask.id&&d.ownerId==='specialist');
  await h.page.getByRole('button',{name:'Open '+selectedTask.title,exact:true}).click();
  if(docs.length>1){await expect(h.page.getByRole('heading',{name:'Choose a task document',exact:true})).toBeVisible();await h.page.getByRole('button',{name:docs[0].title,exact:true}).click();}
  if(docs.length){await expect(h.page).toHaveURL(new RegExp('#project/atlas/document/'+docs[0].id+'$'));await h.page.goBack();await h.page.goForward();await expect(h.page).toHaveURL(new RegExp('#project/atlas/document/'+docs[0].id+'$'));}
  assert.equal(h.actions.length,1);

  results.push({check:`Specialist ${width}: keyboard selection, one contract action, navigation, chooser/open/back-forward without write, no preview creation or horizontal overflow`,pass:true});await h.context.close();
 }
 {
  const h=await scenario('specialist',390);
  const before=h.getState().projects[0].deliveries.length;
  const taskStatus=h.getState().projects[0].tasks.find(t=>t.id==='ux-discovery').status;
  await h.page.goto(app.url+'/#project/atlas/document/methods');
  await h.page.getByLabel('Document content',{exact:true}).fill('Synthetic saved content for Specialist review.');
  await h.page.getByRole('button',{name:'Save draft',exact:true}).click();
  await expect(h.page.getByText('Draft v3 saved. Nothing was submitted.')).toBeVisible();
  assert.equal(h.getState().projects[0].deliveries.length,before);
  assert.equal(h.actions.filter(a=>a.type==='saveDraft').length,1);
  await h.page.getByRole('button',{name:'Save & next'}).click();
  await expect(h.page.getByRole('heading',{name:'Review your submission'})).toBeVisible();
  await h.page.getByRole('checkbox').first().check();
  await h.page.getByRole('button',{name:'Submit selected',exact:true}).click();
  await expect(h.page.getByRole('dialog')).toBeVisible();
  await h.page.getByRole('button',{name:'Submit for review',exact:true}).click();
  await expect(h.page.getByText('Selected versions submitted. The package is now read-only.')).toBeVisible();
  const p=h.getState().projects[0], delivery=p.deliveries.at(-1);
  assert.equal(p.deliveries.length,before+1);assert.equal(delivery.documentVersions.length,1);
  assert.equal(delivery.documentVersions[0].content,'Synthetic saved content for Specialist review.');
  assert.equal(p.tasks.find(t=>t.id==='ux-discovery').status,taskStatus);
  assert.equal(h.actions.filter(a=>a.type==='submitDocuments').length,1);
  await h.page.goto(app.url+'/#project/atlas/document/methods');
  await expect(h.page.getByLabel('Document content',{exact:true})).toHaveAttribute('readonly','');
  await expect(h.page.getByRole('button',{name:'Save draft',exact:true})).toHaveCount(0);
  await h.page.screenshot({path:'specialist-browser-results/submitted-mobile.png',fullPage:true});
  results.push({check:'Mobile save and explicit review submit preserve saved snapshot, lock it, do not complete task',pass:true});
  await h.context.close();
 }
 for(const actor of ['stakeholder','outsider','admin']){
  const h=await scenario(actor);await h.page.goto(app.url+'/#project/atlas/select');
  if(actor==='stakeholder') await expect(h.page.getByRole('heading',{name:'No specialist work assigned'})).toBeVisible();
  else await expect(h.page.getByRole('heading',{name:'Select your work'})).toHaveCount(0);
  await expect(h.page.getByRole('button',{name:'Activate selected work'})).toHaveCount(0);assert.equal(h.actions.length,0);
  results.push({check:actor+' direct route cannot activate Specialist tasks',pass:true});await h.context.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile('specialist-browser-results/results.json',JSON.stringify({results,errors,synthetic:true},null,2));console.log(JSON.stringify(results,null,2));
} finally {await browser.close();await new Promise(r=>app.server.close(r));}
