// Isolated configuration generator. Does not publish, set DNS or activate Auth.
const SUPABASE='https://xupximxdfucawteiuhcr.supabase.co';
export function hostingPolicy({provider,base='/',authenticated=true}={}) {
 if(!['static-header-host','github-pages'].includes(provider))throw Error('HOST_REQUIRED');
 if(provider==='github-pages'&&authenticated)throw Error('PAGES_AUTHENTICATED_RELEASE_BLOCKED');
 // Existing root-relative assets and callback contract require root hosting.
 if(base!=='/')throw Error('SUBPATH_NOT_AUDITED');
 const csp=`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ${SUPABASE}; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`;
 return {base,buildCommand:'npm run build',outputDirectory:'dist',headers:{'Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=()'},htmlCache:'no-store',callbackPath:'/auth/confirm',releaseReady:false,requiredEdgeOrigins:['https://astra.wisecursor.com'],blockers:['Verify Auth/API adapter and real-origin CORS','Verify HTTP headers at chosen host','Verify exact callback without leaking query or fragment','Run role/revocation/idempotency regression']};
}
export function prepareHtml(html, policy){
 if(!html.includes('<head>'))throw Error('HEAD_REQUIRED');
 if(/http-equiv\s*=\s*["']Content-Security-Policy/i.test(html))throw Error('EXISTING_CSP_REVIEW_REQUIRED');
 // Meta is only defense in depth, never a substitute for frame-ancestors HTTP header.
 const metaCsp=policy.headers['Content-Security-Policy'].replace("; frame-ancestors 'none'",'');
 return html.replace('<head>',`<head><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${metaCsp}">`);
}
