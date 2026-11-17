/** Parse/scrub before SDK initialization. No token is returned, logged or stored. */
export const STATIC_CALLBACK_CONFIGURATION=Object.freeze({enabled:false,origin:null,callbackPath:'/auth/confirm',invitationEnabled:false,recoveryEnabled:false});
const fail=code=>{throw Object.assign(new Error(code),{code})};
export function prepareStaticAuthCallback({href,replaceUrl,configuration=STATIC_CALLBACK_CONFIGURATION,verifyTemporary,getVerifiedUser,acceptVerifiedSession}){
 let url;try{url=new URL(href)}catch{fail('INVALID_CALLBACK')}
 const sensitive=['token_hash','access_token','refresh_token','code','error','error_description'];const fragment=new URLSearchParams(url.hash.slice(1));const callback=url.pathname==='/auth/confirm'||sensitive.some(k=>url.searchParams.has(k)||fragment.has(k));
 if(!callback)return null;
 // Erase query and token fragment synchronously, even on rejected or disabled links.
 replaceUrl(url.origin+'/#login');
 let token=url.searchParams.get('token_hash'),type=url.searchParams.get('type'),closed=false,used=false;
 const invalid=url.username||url.password||url.hash||![...url.searchParams.keys()].every(k=>['token_hash','type'].includes(k))||url.searchParams.getAll('token_hash').length!==1||url.searchParams.getAll('type').length!==1||!['invite','recovery'].includes(type)||!token||token.length<16||token.length>1024||!/^[-A-Za-z0-9_]+$/.test(token);
 if(configuration.enabled!==true){token=null;return {status:'disabled',close(){closed=true},consume:async()=>fail('CALLBACK_DISABLED')}}
 let trusted;try{trusted=new URL(configuration.origin)}catch{token=null;fail('CALLBACK_CONFIGURATION_REQUIRED')}
 if(trusted.protocol!=='https:'||trusted.origin!==configuration.origin||url.origin!==trusted.origin||url.pathname!==configuration.callbackPath||invalid){token=null;fail('INVALID_CALLBACK')}
 if(type==='invite'&&configuration.invitationEnabled!==true||type==='recovery'&&configuration.recoveryEnabled!==true){token=null;fail('CALLBACK_DISABLED')}
 if(typeof verifyTemporary!=='function'||typeof getVerifiedUser!=='function'||typeof acceptVerifiedSession!=='function'){token=null;fail('CALLBACK_CONFIGURATION_REQUIRED')}
 const active=()=>{if(closed)fail('CALLBACK_CANCELLED')};
 return {status:'confirmation_required',type,close(){closed=true;token=null},async consume(){active();if(used)fail('CALLBACK_ALREADY_CONSUMED');used=true;const hash=token;token=null;let result;try{result=await verifyTemporary({token_hash:hash,type});active();if(result?.error||!result?.data?.session?.access_token)fail('CALLBACK_REJECTED');const checked=await getVerifiedUser(result.data.session.access_token);active();const user=checked?.data?.user;if(checked?.error||!user?.id||!user.email_confirmed_at||user.id!==result.data.session.user?.id)fail('CALLBACK_REJECTED');await acceptVerifiedSession(result.data.session,{userId:user.id,type,isCurrent:()=>!closed});active();return {status:'verified',userId:user.id,type};}catch(e){if(e?.code==='CALLBACK_CANCELLED')throw e;fail('CALLBACK_REJECTED')}finally{result=null}}};
}
