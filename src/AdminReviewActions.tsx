import { useRef, useState, useId } from 'react';
type Decision = 'approveDelivery' | 'returnDelivery';
export function AdminReviewActions({ version, documentCount, busy, onDecision }: {version:number;documentCount:number;busy:boolean;onDecision:(type:Decision,reason:string)=>Promise<boolean>}) {
 const dialog=useRef<HTMLDialogElement>(null), title=useId();
 const [decision,setDecision]=useState<Decision>('approveDelivery'),[reason,setReason]=useState(''),[sending,setSending]=useState(false);
 const locked=busy||sending;
 function open(type:Decision){if(locked)return;setDecision(type);dialog.current?.showModal();}
 return <div><div className="actions">
  <button type="button" disabled={locked} onClick={()=>open('returnDelivery')}>Request Changes</button>
  <button type="button" disabled={locked} className="primary" onClick={()=>open('approveDelivery')}>Approve</button>
 </div><p className="helper">Records a decision for this saved package in Astra. No external publication.</p>
 <dialog ref={dialog} className="astra-my-task-dialog" aria-labelledby={title} onCancel={e=>{if(locked)e.preventDefault();}}>
 <form onSubmit={async e=>{e.preventDefault();if(locked || (decision==='returnDelivery'&&!reason.trim()))return;setSending(true);try{if(await onDecision(decision,reason)){dialog.current?.close();setReason('');}}finally{setSending(false);}}}>
  <header className="my-task-dialog-heading"><h2 id={title}>{decision==='approveDelivery'?'Approve this package?':'Request changes to this package?'}</h2></header>
  <div className="my-task-dialog-body"><p>Delivery v{version} · {documentCount} saved document{documentCount===1?'':'s'}. Earlier snapshots remain unchanged.</p>
   {decision==='returnDelivery'?<label>Changes requested / reason<textarea autoFocus required maxLength={20000} rows={5} value={reason} disabled={locked} onChange={e=>setReason(e.target.value)}/></label>:<p>Approval applies only to these submitted versions. It does not complete tasks or close the PRD.</p>}
  </div><footer className="actions"><button type="button" disabled={locked} onClick={()=>dialog.current?.close()}>Cancel</button><button type="submit" className="primary" disabled={locked||(decision==='returnDelivery'&&!reason.trim())}>{sending?'Saving…':decision==='approveDelivery'?'Confirm approval':'Send change request'}</button></footer>
 </form></dialog></div>;
}
