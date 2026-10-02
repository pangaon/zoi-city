import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionClient, type Session } from './session';
import { DraftStore } from './drafts';
import {PrivateRequestStore} from './privateRequests';
const KEY = 'zoi.mobile.refresh.v1';
const client = new SessionClient({
  read: async () => Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(KEY) || null : SecureStore.getItemAsync(KEY),
  write: async value => { if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(KEY, value); else await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  clear: async () => { if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); },
});
export const privateRequests=new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage?.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage?.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage?.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id);
export const communityRequests=new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage?.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage?.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage?.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.community-request.');
export const artistDemandRequests=new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage?.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage?.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage?.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.artist-demand-request.');
// Nonce-only enquiry recovery survives sign-out; no message bodies or tokens.
export const inquiryRequests=new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.inquiry-request.');
// Scope names are encoded using letters for the existing store namespace contract.
export function creatorRequestStore(scope:string){
 if(scope!=='customer'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope))throw Error('Invalid creator workspace.');
 const namespace=scope.toLowerCase().replace(/[0-9]/g,d=>String.fromCharCode(103+Number(d)));
 return new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.creator-request.'+namespace+'.');
}
export function operationsRequestStore(scope:string){
 if(scope!=='customer'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope))throw Error('Invalid Operations workspace.');
 const namespace=scope.toLowerCase().replace(/[0-9]/g,d=>String.fromCharCode(103+Number(d)));
 return new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.operations-request.'+namespace+'.');
}
export function youthRequestStore(scope:string){
 if(scope!=='family'&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scope))throw Error('Invalid programme workspace.');
 const namespace=scope.toLowerCase().replace(/[0-9]/g,d=>String.fromCharCode(103+Number(d)));
 return new PrivateRequestStore({getItem:async key=>Platform.OS==='web'?globalThis.sessionStorage.getItem(key)||null:SecureStore.getItemAsync(key),setItem:async(key,value)=>{if(Platform.OS==='web')globalThis.sessionStorage.setItem(key,value);else await SecureStore.setItemAsync(key,value,{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},removeItem:async key=>{if(Platform.OS==='web')globalThis.sessionStorage.removeItem(key);else await SecureStore.deleteItemAsync(key);}},()=>client.session?.user.id,'zoi.youth-request.'+namespace+'.');
}
export const drafts = new DraftStore(AsyncStorage, () => client.session?.user.id);
type AuthState = { workspaceId: string; setWorkspaceId: (id: string) => void; client: SessionClient; session: Session | null; booting: boolean; notice: string; setNotice: (text: string) => void; signOut: () => Promise<void> };
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  useEffect(() => setWorkspaceId(''), [session?.user.id]);
  useEffect(() => {
    let active = true;
    client.onChange = value => { if (active) setSession(value); };
    client.restore().catch(() => { if (active) setNotice('We could not restore your session. Check your connection or sign in again.'); }).finally(() => { if (active) setBooting(false); });
    const subscription = AppState.addEventListener('change', state => { if (state === 'active' && client.session) client.token().catch(error => setNotice(error.message)); });
    return () => { active = false; subscription.remove(); client.onChange = () => {}; };
  }, []);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(() => client.refresh().catch(error => setNotice(error.message)), Math.max(1000, session.expires_at * 1000 - Date.now() - 60000));
    return () => clearTimeout(timer);
  }, [session]);
  const value = useMemo(() => ({ client, session, booting, notice, setNotice, workspaceId, setWorkspaceId, signOut: async () => {
    const userId = client.session?.user.id;
    try { await client.signOut(); setNotice('You are signed out.'); }
    catch { setNotice('Signed out on this device. The server could not confirm revocation; retry when connected.'); }
    finally { if (userId) await Promise.all([drafts.clear(userId), privateRequests.clear(userId), communityRequests.clear(userId), artistDemandRequests.clear(userId), AsyncStorage.removeItem('zoi.workspace.' + userId)]).catch(() => setNotice('Signed out, but device drafts could not be removed.'));  }
  } }), [session, booting, notice, workspaceId]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider required'); return value; }
export { AsyncStorage };
