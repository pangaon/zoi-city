import {type ReactNode,useEffect,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Linking} from 'react-native';
import {WelcomeLanding} from './WelcomeLanding';

export type WelcomeDestination = 'home' | 'discover' | 'community' | 'tickets' | 'grow';
const COMPLETED_KEY = 'zoi.welcome.v1';
/** The welcome is device-level UI state. It never stores an account, interest or permission. */
export function WelcomeGate({ children }: { children: (initial: WelcomeDestination, pendingLink: string | null) => ReactNode }) {
  const [phase, setPhase] = useState<'checking' | 'welcome' | 'ready'>('checking');
  const [pendingLink,setPendingLink]=useState<string|null>(null);
  const phaseRef=useRef(phase),linkIntent=useRef(false);phaseRef.current=phase;
  const [destination, setDestination] = useState<WelcomeDestination>('home');
  const [saving,setSaving]=useState(false);
  const choosing = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const acceptLink=(url:string|null)=>{if(!mounted.current||!url?.startsWith('zoi://')||phaseRef.current==='ready')return false;linkIntent.current=true;setPendingLink(url);setPhase('ready');return true;};
    const subscription=Linking.addEventListener('url',event=>acceptLink(event.url));
    const fallback = new Promise<[string | null, string | null]>(resolve => { timer = setTimeout(() => resolve([null, null]), 3000); });
    // Opening a client's link takes precedence over the general welcome.
    const initial = Promise.all([AsyncStorage.getItem(COMPLETED_KEY).catch(() => null), Linking.getInitialURL().catch(() => null)]);
    Promise.race([initial, fallback]).then(([completed, url]) => {
      if (!mounted.current||linkIntent.current) return;
      if(!acceptLink(url))setPhase(completed === 'complete' ? 'ready' : 'welcome');
    }).finally(() => clearTimeout(timer));
    return () => { mounted.current = false; clearTimeout(timer); subscription.remove(); };
  }, []);
  async function finish(next: WelcomeDestination) {
    if (choosing.current) return;
    choosing.current = true; setSaving(true);
    // Storage may be unavailable. Never trap the visitor in onboarding.
    let timer: ReturnType<typeof setTimeout>;
    await Promise.race([AsyncStorage.setItem(COMPLETED_KEY, 'complete').catch(() => {}), new Promise<void>(resolve => { timer = setTimeout(resolve, 1500); })]);
    clearTimeout(timer!);
    if (mounted.current&&!linkIntent.current) { setDestination(next); setPhase('ready'); }
  }
  if (phase === 'ready') return children(destination,pendingLink);
  return <WelcomeLanding checking={phase==='checking'} saving={saving} onChoose={next=>{if(phase==='welcome')void finish(next);}}/>;
}
