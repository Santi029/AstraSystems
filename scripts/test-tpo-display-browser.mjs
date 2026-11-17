import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { startServer } from '../server/index.mjs';
import { createInitialState, viewState, applyAction } from '../server/domain.mjs';
const app=await startServer({production:true,authMode:'accounts',port:0,loopbackOnly:true});
const browser=await chromium.launch({headless:true,...(process.env.ASTRA_TEST_CHROMIUM ? {executablePath:process.env.ASTRA_TEST_CHROMIUM} : {})});
const results=[], errors=[];
await mkdir('tpo-browser-results',{recursive:true});
try {
 async function scenario(actor,width=1280) {
  let state=createInitialState(), actions=[];
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:process.env.ASTRA_REDUCED_MOTION==='1'?'reduce':'no-preference'});
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
 for(const width of [1440,390]){
 const h=await scenario('admin',width),state=h.getState();const longName='María Fernanda Santiago Rodríguez de los Santos — Synthetic Long Name';
 state.demo=false;for(const person of state.actors){person.globalRoles=[person.id==='admin'?'Admin':person.id==='stakeholder'?'Stakeholder':'QA'];person.identityVerified=true;person.accountStatus='active';person.accessVersion=1;if(person.id==='admin'){person.name=longName;person.globalRoles.push('PM');}}state.people=structuredClone(state.actors);
 if(state.people)for(const person of state.people)if(person.id==='admin')person.name=longName;
 const project=state.projects.find(p=>p.id==='atlas');const member=project.team.find(t=>t.personId==='admin');member.roles=[...new Set([...member.roles,'PM'])];
 await h.page.goto(app.url+'/#project/atlas/team');
 await expect(h.page.getByRole('cell',{name:'Technical Product Owner',exact:true})).toBeVisible();
 await expect(h.page.getByRole('button',{name:'Edit '+longName+' · Technical Product Owner',exact:true})).toBeVisible();
 await h.page.waitForTimeout(600);
 const shell=await h.page.locator('.main-shell').boundingBox();
 const overflow=await h.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
 await h.page.screenshot({path:'tpo-browser-results/viewport-'+width+'.png',fullPage:false});
 await h.page.screenshot({path:'tpo-browser-results/team-'+(process.env.ASTRA_REDUCED_MOTION==='1'?'reduce-':'normal-')+width+'.png',fullPage:true,animations:'disabled'});
 await h.page.getByRole('button',{name:'Edit '+longName+' · Technical Product Owner',exact:true}).click();
 const dialog=h.page.getByRole('dialog');await expect(dialog).toBeVisible();
 const option=dialog.locator('option[value="PM"]');await expect(option).toHaveText('Technical Product Owner');assert.equal(await dialog.locator('option[value="Technical Product Owner"]').count(),0);
 await h.page.screenshot({path:'tpo-browser-results/dialog-'+(process.env.ASTRA_REDUCED_MOTION==='1'?'reduce-':'normal-')+width+'.png',fullPage:true,animations:'disabled'});
 assert.equal(h.actions.length,0);results.push({width,shell,overflow,displayLabel:true,roleIdentifier:'PM',actions:0});await h.context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('tpo-browser-results/results-'+(process.env.ASTRA_REDUCED_MOTION==='1'?'reduce':'normal')+'.json',JSON.stringify({results,errors,synthetic:true},null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();await new Promise(r=>app.server.close(r));}
