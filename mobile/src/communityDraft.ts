import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {randomUUID} from 'expo-crypto';
import {createMemberDraft} from '../../assets/community/member-draft.mjs';
type Client={session:{user:{id:string}}|null;token:()=>Promise<string>;request:(path:string,body:unknown,token:string)=>Promise<any>};
export async function memberDraftRpc(client:Client,actor:string,current:()=>boolean,name:string,args:Record<string,unknown>){
 const check=()=>{if(client.session?.user.id!==actor||!current())throw Error('Your Community account changed.');};
 if(!['community_draft_get','community_draft_history','community_draft_request','community_draft_mutate','community_delete_post','community_me','community_publish'].includes(name))throw Error('Unsupported private Community request.');
 check();const token=await client.token();check();const value=await client.request('/rest/v1/rpc/'+name,args,token);check();return value;
}
const localLocks=new Map<string,Promise<unknown>>();
export function nativeMemberDraft(client:Client,actor:string,current:()=>boolean,changed:()=>void){
 const key='zoi.community-draft-ref.'+actor;
 return createMemberDraft({actor,current,changed,nonce:randomUUID,call:(name:string,args:Record<string,unknown>)=>memberDraftRpc(client,actor,current,name,args),storage:{load:async()=>{const v=await AsyncStorage.getItem(key);return v?JSON.parse(v):null;},save:(v:unknown)=>AsyncStorage.setItem(key,JSON.stringify(v)),clear:()=>AsyncStorage.removeItem(key)},lock:async(name:string,fn:()=>Promise<unknown>)=>{if(Platform.OS==='web'){const locks=(globalThis.navigator as any)?.locks;if(!locks?.request)throw Error('Private draft recovery needs shared browser locks. Open Community in a supported browser.');return locks.request(name,fn);}const before=localLocks.get(name)||Promise.resolve();let release!:()=>void;const next=new Promise<void>(r=>release=r);localLocks.set(name,before.catch(()=>{}).then(()=>next));await before.catch(()=>{});try{return await fn();}finally{release();}}});
}
