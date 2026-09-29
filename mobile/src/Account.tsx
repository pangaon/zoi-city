import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AsyncStorage, drafts, useAuth } from './Auth';
import { validPostReceipt } from './drafts';
const color = { navy: '#132F46', blue: '#116CBA', muted: '#60717E' };
function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.action, disabled && { opacity: 0.55 }]}><Text style={styles.actionText}>{label}</Text></Pressable>; }
export function AccountPanel() {
  const { client, session, booting, notice, setNotice, signOut } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [code, setCode] = useState('');
  const [mode, setMode] = useState<'password' | 'email'>('password'); const [sent, setSent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string; role?: string }[]>([]); const [selected, setSelected] = useState(''); const [workspaceError, setWorkspaceError] = useState(''); const [workspaceLoading, setWorkspaceLoading] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true; setWorkspaces([]); setSelected(''); setWorkspaceError('');
    if (!session) return;
    setWorkspaceLoading(true);
    Promise.all([client.rpc('zoi_me', {}), AsyncStorage.getItem('zoi.workspace.' + session.user.id)]).then(([me, saved]) => {
      if (!me || !Array.isArray(me.workspaces)) throw new Error('Your workspace list could not be loaded.');
      if (current) { setWorkspaces(me.workspaces); setSelected(me.workspaces.some((w: { id: string }) => w.id === saved) ? saved! : me.workspaces[0]?.id || ''); }
    }).catch(() => { if (current) setWorkspaceError('Your workspaces could not be loaded. Please try again.'); }).finally(() => { if (current) setWorkspaceLoading(false); });
    return () => { current = false; };
  }, [session?.user.id, reload, client]);
  const submit = async () => {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    if (mode === 'password' && !password) { setError('Enter your password.'); return; }
    if (mode === 'email' && sent && !code.trim()) { setError('Enter the code from your email.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'password') await client.password(email.trim(), password);
      else if (sent) await client.verifyCode(email.trim(), code.trim());
      else { await client.sendCode(email.trim()); setSent(true); }
      setPassword(''); setCode('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  };
  return <View style={styles.panel}><Text style={styles.title}>Your Zoi account</Text>{notice ? <Text accessibilityRole="alert" style={styles.message}>{notice}</Text> : null}{booting ? <ActivityIndicator color={color.blue} /> : session ? <>
    <Text style={styles.body}>{session.user.email || 'Signed in'}</Text><Text style={styles.heading}>Your workspaces</Text>{workspaceLoading ? <ActivityIndicator color={color.blue} /> : workspaceError ? <><Text accessibilityRole="alert" style={styles.body}>{workspaceError}</Text><Action label="Reload workspaces" onPress={() => setReload(v => v + 1)} /></> : workspaces.length ? workspaces.map(workspace => <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected === workspace.id }} key={workspace.id} style={[styles.workspace, selected === workspace.id && styles.selected]} onPress={async () => { setSelected(workspace.id); try { await AsyncStorage.setItem('zoi.workspace.' + session.user.id, workspace.id); } catch { setWorkspaceError('Selection works for this session, but could not be saved.'); } }}><Text style={styles.heading}>{selected === workspace.id ? '● ' : '○ '}{workspace.name || 'Workspace'}</Text>{workspace.role ? <Text style={styles.body}>{workspace.role}</Text> : null}</Pressable>) : <Text style={styles.body}>No workspaces yet. Create your business workspace on the Zoi website.</Text>}
    <Text style={styles.small}>Workspace selection is saved on this device. Business management currently opens on the website.</Text><Action label={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={async () => { setBusy(true); try { await signOut(); } finally { setBusy(false); } }} />
  </> : <><Text style={styles.body}>Sign in to post to the community and access your workspaces.</Text><TextInput accessibilityLabel="Email address" style={styles.input} placeholder="Email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} editable={!busy && !sent} onChangeText={setEmail} />{mode === 'password' ? <TextInput accessibilityLabel="Password" style={styles.input} placeholder="Password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={submit} /> : sent ? <><Text style={styles.body}>Enter the code sent to {email}. If your email contains only a link, use your password or complete sign-in on the website.</Text><TextInput accessibilityLabel="Email sign-in code" style={styles.input} placeholder="Email code" autoComplete="one-time-code" keyboardType="number-pad" value={code} onChangeText={setCode} editable={!busy} onSubmitEditing={submit} /></> : <Text style={styles.small}>A sign-in code will be sent to your email address. New members can create an account this way.</Text>}{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Action disabled={busy} label={busy ? 'Please wait…' : mode === 'password' ? 'Sign in' : sent ? 'Verify code' : 'Email me a code'} onPress={submit} /><Action disabled={busy} label={mode === 'password' ? 'Use an email code instead' : 'Use a password instead'} onPress={() => { setMode(mode === 'password' ? 'email' : 'password'); setSent(false); setError(''); setCode(''); }} />{sent ? <Action label="Use a different email" disabled={busy} onPress={() => { setSent(false); setCode(''); }} /> : null}</>}</View>;
}
export function CommunityComposer({ onPublished }: { onPublished: () => void }) {
  const { client, session } = useAuth();
  const [body, setBody] = useState(''); const [hydrated, setHydrated] = useState(false); const [posting, setPosting] = useState(false); const [draftSaved, setDraftSaved] = useState(false); const [message, setMessage] = useState(''); const inFlight = useRef(false);
  const userId = session?.user.id;
  const activeUser = useRef(userId); activeUser.current = userId;
  const alive = useRef(true); useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { let active = true; setBody(''); setHydrated(false); setMessage(''); setPosting(false); if (!userId) return; drafts.load(userId).then(value => { if (active) { setBody(value || ''); setDraftSaved(true); } }).catch(() => { if (active) setMessage('The saved draft could not be loaded.'); }).finally(() => { if (active) setHydrated(true); }); return () => { active = false; }; }, [userId]);
  useEffect(() => { if (!userId || !hydrated) return; setDraftSaved(false); let active = true; const timer = setTimeout(() => drafts.save(userId, body).then(() => { if (active) setDraftSaved(true); }).catch(() => { if (active) setMessage('Your draft could not be saved on this device.'); }), 300); return () => { active = false; clearTimeout(timer); }; }, [body, userId, hydrated]);
  if (!session) return <View style={styles.panel}><Text style={styles.heading}>Add your voice</Text><Text style={styles.body}>Sign in from the Grow tab to share with the community.</Text></View>;
  const post = async () => {
    if (inFlight.current || !body.trim() || body.trim().length > 1000 || !hydrated) return;
    const publishingUser = session.user.id;
    inFlight.current = true; setPosting(true); setMessage('');
    try { const result = await client.rpc('feed_post', { p_body: body.trim(), p_listing: null, p_nameday: null }); if (!validPostReceipt(result)) throw new Error(); await drafts.clear(publishingUser); if (!alive.current || activeUser.current !== publishingUser || client.session?.user.id !== publishingUser) return; setBody(''); setMessage('Your post was published.'); onPublished();  }
    catch { if (alive.current && activeUser.current === publishingUser && client.session?.user.id === publishingUser) setMessage('We could not confirm publication. Your draft is preserved. Refresh the feed before trying again to avoid a duplicate.'); }
    finally { inFlight.current = false; if (alive.current && activeUser.current === publishingUser) setPosting(false); }
  };
  return <View style={styles.panel}><Text style={styles.heading}>Share with your community</Text><TextInput accessibilityLabel="Community post" placeholder="What would you like to share?" multiline maxLength={1000} value={body} onChangeText={setBody} editable={hydrated && !posting} style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]} /><Text style={styles.small}>{body.length}/1000 · {draftSaved ? 'Draft saved on this device' : 'Saving draft…'}</Text>{message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}<Action label={posting ? 'Publishing…' : 'Publish to Zoi'} disabled={!hydrated || posting || !body.trim()} onPress={post} /></View>;
}
const styles = StyleSheet.create({ panel: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#DFE6EB', borderRadius: 18, padding: 20, gap: 16 }, title: { fontSize: 24, fontWeight: '700', color: color.navy }, heading: { fontSize: 17, fontWeight: '700', color: color.navy }, body: { color: color.muted, fontSize: 15, lineHeight: 24 }, small: { color: color.muted, fontSize: 12, lineHeight: 19 }, input: { borderWidth: 1, borderColor: '#CAD7E0', borderRadius: 10, padding: 14, minHeight: 48, color: color.navy, fontSize: 16 }, action: { backgroundColor: '#EAF4FB', padding: 14, minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 10 }, actionText: { color: color.blue, fontWeight: '700' }, error: { color: '#9A301E', lineHeight: 23 }, message: { color: color.navy, fontSize: 14, lineHeight: 22 }, workspace: { padding: 16, borderWidth: 1, borderColor: '#DFE6EB', borderRadius: 12, gap: 6 }, selected: { borderColor: color.blue, backgroundColor: '#EAF4FB' } });
