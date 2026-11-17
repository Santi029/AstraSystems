import {prepareStaticAuthCallback} from './static-auth-callback.mjs';
import {createClient} from '@supabase/supabase-js';
import {createStaticSupabaseTransport} from './static-supabase-transport.mjs';
const config={url:'https://xupximxdfucawteiuhcr.supabase.co',functionName:'astra-api',sessionGuardEnabled:false,publishableKey:'sb_publishable_uju07x1uMjlVm6Z4zjLPeQ_ZRMCHCZK'};
export const staticMode=(import.meta as unknown as {env:Record<string,string>}).env?.VITE_STATIC_SUPABASE==='true';
export const staticCallbackRejected=staticMode&&typeof window!=='undefined'?!!prepareStaticAuthCallback({href:location.href,replaceUrl:url=>history.replaceState(null,'',url)}):false;
const transport=staticMode?createStaticSupabaseTransport({config,onInvalidated:(reason)=>window.dispatchEvent(new CustomEvent('astra-session-ended',{detail:reason})),clientFactory:()=>createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}})}):null;
const channel=staticMode&&typeof BroadcastChannel!=='undefined'?new BroadcastChannel('astra-static-session-events-v1'):null;
channel?.addEventListener('message',event=>{if(event.data==='signed-out'){transport?.invalidate('signed-out-elsewhere');}});
export async function appFetch(input:string,init?:RequestInit){if(!transport)return fetch(input,init);const result=await transport.request(input,init);if(input==='/api/auth/sign-out'){channel?.postMessage('signed-out');}return result;}
