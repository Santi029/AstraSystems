import { hasVerifiedOwnTasksRelease } from './own-tasks-release.ts';
import { createBackendContract, type ContractMode } from './backend-contract.ts';
/** Build-time operator record only. NEVER populate from server DTO, URL, storage or environment. */
export type DocumentPolicyRelease = Readonly<{
  contract: 'document-edit-epoch-v1';
  projectRef: string;
  edgeArtifactSha256: string;
  sqlReadbackSha256: string;
  verifiedAt: string;
  targetPeopleAccessVersion: true;
  currentUserCommitVersionGuard: true;
  failClosedEpochTests: true;
}>;
const PROJECT = 'xupximxdfucawteiuhcr';
/** CLOSED. Change only after coordinating root verifies actual live Edge AND SQL readbacks. */
const VERIFIED_RELEASE: DocumentPolicyRelease | null = {
  "contract": "document-edit-epoch-v1",
  "projectRef": "xupximxdfucawteiuhcr",
  "edgeArtifactSha256": "93d44d67778029589ef10dd3f39007d897dea4121a7cd31c440c225a5546a0ec",
  "sqlReadbackSha256": "b7dc9698be30729c67ded50f26da247c74968c0c6517747d7214778af61f35f2",
  "verifiedAt": "2026-11-17T04:53:48Z",
  "targetPeopleAccessVersion": true,
  "currentUserCommitVersionGuard": true,
  "failClosedEpochTests": true
};
export function isVerifiedDocumentPolicyRelease(value: unknown): value is DocumentPolicyRelease {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = ['contract','projectRef','edgeArtifactSha256','sqlReadbackSha256','verifiedAt','targetPeopleAccessVersion','currentUserCommitVersionGuard','failClosedEpochTests'];
  return Object.keys(v).length === keys.length && Object.keys(v).every(k => keys.includes(k)) &&
    v.contract === 'document-edit-epoch-v1' && v.projectRef === PROJECT &&
    typeof v.edgeArtifactSha256 === 'string' && /^[a-f0-9]{64}$/.test(v.edgeArtifactSha256) &&
    typeof v.sqlReadbackSha256 === 'string' && /^[a-f0-9]{64}$/.test(v.sqlReadbackSha256) &&
    typeof v.verifiedAt === 'string' && Number.isFinite(Date.parse(v.verifiedAt)) &&
    v.targetPeopleAccessVersion === true && v.currentUserCommitVersionGuard === true && v.failClosedEpochTests === true;
}
/** Local release gate is not backend authorization or an automatic network verification. */
export function createReleasedBackendContract(mode: ContractMode) {
  if (mode !== 'accounts' || !isVerifiedDocumentPolicyRelease(VERIFIED_RELEASE)) return createBackendContract({mode});
  const profile = hasVerifiedOwnTasksRelease(VERIFIED_RELEASE.edgeArtifactSha256) ? 'astra-v8-own-tasks' : 'astra-role-epoch';
  const narrow = createBackendContract({profile,purpose:'test',mode:'accounts'});
  return Object.freeze({...narrow,profile:'astra-role-epoch-verified',purpose:'active',activationAllowed:true});
}
