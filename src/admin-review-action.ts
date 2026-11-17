import { canShowProjectAdminActions } from './backend-contract.ts';
type Row = Record<string, any>;
export function prepareReviewDecision(state: Row | null, projectId: string, reviewed: Row, type: 'approveDelivery' | 'returnDelivery', reason = '') {
 const project=state?.projects?.find((p: Row)=>p.id===projectId);
 if(!state || !project || !(state.demo===true ? project.isAdmin===true : canShowProjectAdminActions(state,project))) return {ok:false as const,message:'Current project Admin access is required. Refresh before deciding.'};
 const current=project.deliveries?.find((d: Row)=>d.id===reviewed.id);
 if(!current || !['submitted','under_review'].includes(current.status) || current.version!==reviewed.version || JSON.stringify(current.documentVersions)!==JSON.stringify(reviewed.documentVersions)) return {ok:false as const,message:'This package changed or already has a decision. Refresh and review it again.'};
 if(type==='returnDelivery' && (!reason.trim() || reason.length>20000)) return {ok:false as const,message:'Enter a reason for the requested changes (up to 20,000 characters).'};
 return {ok:true as const,payload:{projectId,deliveryId:reviewed.id,...(type==='returnDelivery'?{reason:reason.trim()}:{})}};
}
