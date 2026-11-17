import { useState } from 'react';
type Props = { enabled: boolean; isAdmin: boolean; projectId: string; documentId: string; ownerName: string; granted: boolean; expired?: boolean; busy: boolean; action: (type: string, payload: Record<string, unknown>, message: string) => Promise<unknown> };
/** Presentation gate only. Current server Admin, ownership and epoch are authoritative. */
export function DocumentEditPermission(p: Props) {
  const [intent, setIntent] = useState<boolean | null>(null);
  if (!p.enabled || !p.isAdmin) return null;
  return <section className="panel padded" aria-label="Document edit permission">
    <h3>Document editing exception</h3>
    <p>Applies only to this document and its current owner, {p.ownerName}. It does not transfer ownership or bypass review. A role or account security change ends the exception.</p>
    {p.expired && <p role="status">The previous permission expired. Editing is not enabled by that permission. Confirm a new allowance only if needed.</p>}
    {intent === null ? <button disabled={p.busy} onClick={() => setIntent(!p.granted)}>{p.granted ? 'Revoke document editing' : 'Allow document editing'}</button> : <>
      <p role="status">{intent ? 'Allow' : 'Revoke'} editing for {p.ownerName} on this document?</p>
      <button disabled={p.busy} onClick={() => setIntent(null)}>Cancel</button>
      <button disabled={p.busy} onClick={async () => { const result = await p.action('setDocumentEditPermission', {projectId:p.projectId,documentId:p.documentId,allowEdit:intent}, intent ? 'Document editing permission granted.' : 'Document editing permission revoked.'); if (result !== null) setIntent(null); }}>Confirm {intent ? 'allow' : 'revoke'}</button>
    </>}
  </section>;
}
