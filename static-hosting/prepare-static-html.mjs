// Local post-build step only. Does not deploy or replace HTTP security headers.
import {readFile,writeFile} from 'node:fs/promises';
import {hostingPolicy,prepareHtml} from './hosting-policy.mjs';
if(process.env.VITE_STATIC_SUPABASE!=='true')throw Error('STATIC_BUILD_FLAG_REQUIRED');
const target=new URL('../dist/index.html',import.meta.url);
const html=await readFile(target,'utf8');
await writeFile(target,prepareHtml(html,hostingPolicy({provider:'static-header-host'})));
console.log('Static HTML meta CSP/referrer added; HTTP headers still required.');

// Preserve the owner's existing CNAME in built assets, without changing DNS.
let cname;try{cname=await readFile(new URL('../CNAME',import.meta.url),'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
if(cname!==undefined){if(cname.trim()!=='astra.wisecursor.com')throw Error('CNAME_REVIEW_REQUIRED');await writeFile(new URL('../dist/CNAME',import.meta.url),cname);}
