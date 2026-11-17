/** Staging adapter only. No tokens, titles, documents, emails or action payloads persisted.
 * Locks must be shared across tabs (e.g. navigator.locks); no unsafe fallback.
 * The authenticated transport and backend remain the authority. */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rec=v=>v && typeof v==='object' && !Array.isArray(v);
const fail=code=>{throw Object.assign(new Error(code),{code})};
export function createOwnTaskRecovery({storage,locks,scope,post,receipt,id=()=>crypto.randomUUID()}){
  if(!storage || typeof locks?.request!=='function')fail('DURABLE_RECOVERY_UNAVAILABLE');
  if(!rec(scope)||!['workspaceId','userId','projectId'].every(k=>typeof scope[k]==='string'&&scope[k].length>0&&scope[k].length<=200))fail('INVALID_SCOPE');
  const expected={workspaceId:scope.workspaceId,userId:scope.userId,projectId:scope.projectId};
  const key='astra:own-task-recovery:v1:'+JSON.stringify(Object.values(expected));
  let closed=false;
  const active=()=>{if(closed)fail('SESSION_CLOSED')};
  function load(){active();let raw;try{raw=storage.getItem(key)}catch{fail('RECOVERY_STORAGE_UNAVAILABLE')}if(raw===null)return null;let m;try{m=JSON.parse(raw)}catch{fail('RECOVERY_METADATA_INVALID')}
    if(!rec(m)||Object.keys(m).sort().join(',')!=='count,expectedRevision,projectId,requestId,userId,v,workspaceId'||m.v!==1||!uuid.test(m.requestId)||!Number.isSafeInteger(m.expectedRevision)||m.expectedRevision<0||!Number.isInteger(m.count)||m.count<1||m.count>100||Object.keys(expected).some(k=>m[k]!==expected[k]))fail('RECOVERY_METADATA_INVALID');return m;
  }
  function confirmed(reply,m){const r=reply?.receipt,s=reply?.state,v=r?.result,p=s?.projects?.find(p=>p.id===expected.projectId);
    if(reply?.ok!==true||r?.requestId!==m.requestId||r.status!=='committed'||s?.currentActor?.id!==expected.userId||!Number.isSafeInteger(s.revision)||s.revision<=m.expectedRevision||v?.ownerId!==expected.userId||v.status!=='available'||v.count!==m.count||!Array.isArray(v.created)||v.created.length!==m.count||!Array.isArray(p?.tasks)||!Array.isArray(p?.documents))return false;
    if(new Set(v.created.map(x=>x?.taskId)).size!==m.count||new Set(v.created.map(x=>x?.documentId)).size!==m.count)return false;
    return v.created.every(x=>rec(x)&&typeof x.taskId==='string'&&x.taskId&&typeof x.documentId==='string'&&x.documentId&&p.tasks.some(t=>t.id===x.taskId&&t.ownerId===expected.userId&&t.title===x.title&&t.documentIds?.includes(x.documentId))&&p.documents.some(d=>d.id===x.documentId&&d.ownerId===expected.userId&&d.taskId===x.taskId));
  }
  async function recoverLocked(){const m=load();if(!m)return {status:'idle'};let r;try{r=await receipt(m.requestId)}catch{return {status:'uncertain'}}active();if(!confirmed(r,m))return {status:'uncertain'};
    // Never clear a newer/different pending operation or malformed storage.
    if(JSON.stringify(load())!==JSON.stringify(m))fail('RECOVERY_CHANGED');
    try{storage.removeItem(key);if(storage.getItem(key)!==null)fail('RECOVERY_STORAGE_UNAVAILABLE')}catch{fail('RECOVERY_STORAGE_UNAVAILABLE')}
    return {status:'committed',requestId:m.requestId};
  }
  return {
    pending:()=>load(),
    recover:()=>locks.request(key,async()=>{active();return recoverLocked()}),
    async submit({titles,expectedRevision}){active();return locks.request(key,async()=>{active();if(load())fail('PENDING_OPERATION');if(!Array.isArray(titles)||titles.length<1||titles.length>100||titles.some(t=>typeof t!=='string'||!t.trim()||t.length>200)||!Number.isSafeInteger(expectedRevision)||expectedRevision<0)fail('INVALID_INPUT');
      const requestId=id();if(!uuid.test(requestId))fail('INVALID_REQUEST_ID');
      const body={type:'createOwnTasks',projectId:expected.projectId,titles:titles.map(t=>t.trim()),requestId,expectedRevision};
      const m={v:1,...expected,requestId,expectedRevision,count:titles.length};
      try{storage.setItem(key,JSON.stringify(m));if(JSON.stringify(load())!==JSON.stringify(m))fail('RECOVERY_STORAGE_UNAVAILABLE')}catch{fail('RECOVERY_STORAGE_UNAVAILABLE')}
      // Mark durable before sending. A crash before POST is conservative: remains blocked.
      try{await post(body)}catch{/* a rejected/aborted response does not establish non-commit */}
      active();return recoverLocked();
    })},
    close(){closed=true}, // Logout stops this instance; retain only metadata for same-user return.
  };
}
