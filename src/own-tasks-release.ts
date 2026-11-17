/** Build-time operator record only. No DTO, environment or browser storage activation. */
export type OwnTasksRelease = { contract:'own-tasks-epoch-receipts-v1'; edgeArtifactSha256:string; sqlReadbackSha256:string; projectRef:string; verifiedAt:string; metadataOnlyRecovery:true; receiptRecoveryNoReplay:true; logoutGenerationGuard:true };
const VERIFIED_OWN_TASKS_RELEASE: OwnTasksRelease | null = {
  "contract": "own-tasks-epoch-receipts-v1",
  "edgeArtifactSha256": "93d44d67778029589ef10dd3f39007d897dea4121a7cd31c440c225a5546a0ec",
  "sqlReadbackSha256": "b7dc9698be30729c67ded50f26da247c74968c0c6517747d7214778af61f35f2",
  "projectRef": "xupximxdfucawteiuhcr",
  "verifiedAt": "2026-11-17T05:01:09.262941+00:00",
  "metadataOnlyRecovery": true,
  "receiptRecoveryNoReplay": true,
  "logoutGenerationGuard": true
};
export function validOwnTasksRelease(v:unknown):v is OwnTasksRelease { if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;return Object.keys(x).sort().join(',')==='contract,edgeArtifactSha256,logoutGenerationGuard,metadataOnlyRecovery,projectRef,receiptRecoveryNoReplay,sqlReadbackSha256,verifiedAt'&&x.contract==='own-tasks-epoch-receipts-v1'&&x.projectRef==='xupximxdfucawteiuhcr'&&x.edgeArtifactSha256==='93d44d67778029589ef10dd3f39007d897dea4121a7cd31c440c225a5546a0ec'&&x.sqlReadbackSha256==='b7dc9698be30729c67ded50f26da247c74968c0c6517747d7214778af61f35f2'&&typeof x.verifiedAt==='string'&&Number.isFinite(Date.parse(x.verifiedAt))&&x.metadataOnlyRecovery===true&&x.receiptRecoveryNoReplay===true&&x.logoutGenerationGuard===true; }
export function hasVerifiedOwnTasksRelease(edgeArtifact:string){return validOwnTasksRelease(VERIFIED_OWN_TASKS_RELEASE)&&VERIFIED_OWN_TASKS_RELEASE.edgeArtifactSha256===edgeArtifact;}
