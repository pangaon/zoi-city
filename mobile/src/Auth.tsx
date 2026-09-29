import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SessionClient, type Session } from './session';
const KEY = 'zoi.mobile.refresh.v1';
const client = new SessionClient({
  read: async () => Platform.OS === 'web' ? globalThis.sessionStorage?.getItem(KEY) || null : SecureStore.getItemAsync(KEY),
  write: async value => { if (Platform.OS === 'web') globalThis.sessionStorage?.setItem(KEY, value); else await SecureStore.setItemAsync(KEY, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }); },
  clear: async () => { if (Platform.OS === 'web') globalThis.sessionStorage?.removeItem(KEY); else await SecureStore.deleteItemAsync(KEY); },
});
type AuthState = { client: SessionClient; session: Session | null; booting: boolean; notice: string; setNotice: (text: string) => void; signOut: () => Promise<void> };
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [notice, setNotice] = useState('');
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
  const value = useMemo(() => ({ client, session, booting, notice, setNotice, signOut: async () => {
    const userId = client.session?.user.id;
    try { await client.signOut(); setNotice('You are signed out.'); }
    catch { setNotice('Signed out on this device. The server could not confirm revocation; retry when connected.'); }
    finally { if (userId) await AsyncStorage.multiRemove(['zoi.draft.' + userId, 'zoi.workspace.' + userId]); }
  } }), [session, booting, notice]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() { const value = useContext(Context); if (!value) throw new Error('AuthProvider required'); return value; }
export { AsyncStorage };
