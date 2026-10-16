import {StatusBar} from 'expo-status-bar';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Image, Linking, Platform, Pressable, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaleText as Text } from './ScaleText';
import { AegeanArt } from './AegeanArt';
import { Icon } from './Icon';

export type WelcomeDestination = 'home' | 'discover' | 'community' | 'tickets' | 'grow';
const COMPLETED_KEY = 'zoi.welcome.v1';
const slides = [
  { label: 'WELCOME TO ZOI', title: 'Greece, in\nyour hand.', body: 'Your people. Your places. Your next chapter. A Greek world that goes wherever life takes you.', icon: 'discover' },
  { label: 'EVERY CONNECTION COUNTS', title: 'Find your\nparea.', body: 'Meet people, discover businesses and follow the artists and communities that matter to you.', icon: 'community' },
  { label: 'MAKE YOURSELF AT HOME', title: 'Where shall\nwe begin?', body: 'Choose a starting point. You can explore freely and sign in when you want to take part.', icon: 'home' },
] as const;

/** The welcome is device-level UI state. It never stores an account, interest or permission. */
export function WelcomeGate({ children }: { children: (initial: WelcomeDestination, pendingLink: string | null) => ReactNode }) {
  const [phase, setPhase] = useState<'checking' | 'welcome' | 'ready'>('checking');
  const [pendingLink,setPendingLink]=useState<string|null>(null);
  const phaseRef=useRef(phase),linkIntent=useRef(false);phaseRef.current=phase;
  const [destination, setDestination] = useState<WelcomeDestination>('home');
  const {fontScale}=useWindowDimensions();
  const [choice,setChoice]=useState<WelcomeDestination>('discover');
  const [step, setStep] = useState(0), [saving, setSaving] = useState(false);
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
  if (phase === 'checking') return <View style={s.loading}><ActivityIndicator color="#aeeaf5" accessibilityLabel="Opening Zoi" /></View>;
  const slide = slides[step];
  return <LinearGradient colors={['#0b213c', '#07506d', '#076775']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.frame}>
    <AegeanArt animated />
    <StatusBar style="light"/><SafeAreaView style={s.safe}>
      <View style={s.top}><View style={s.brand}><Image source={require('../assets/zoi-logo.png')} resizeMode="contain" style={s.logo} accessible={false} /><Text style={s.wordmark}>Zoi</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Skip welcome and explore Zoi" disabled={saving} onPress={() => void finish('home')} style={s.skip}><Text style={s.skipText}>Skip</Text></Pressable></View>
      <ScrollView key={step} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.symbol}><Icon name={slide.icon} size={40} color="#c3f8ff" /></View>
        <Text style={s.eyebrow}>{slide.label}</Text><Text accessibilityRole="header" accessibilityLiveRegion="polite" style={[s.title,fontScale>1.4&&{fontSize:34,lineHeight:39}]}>{slide.title}</Text><Text style={s.body}>{slide.body}</Text>
        {step === 2 && <View style={s.choices}>{([
          ['discover', 'Explore people & places', 'discover'], ['community', 'Meet the community', 'community'], ['tickets', 'Find events', 'tickets'], ['grow', 'My business or creative work', 'grow'],
        ] as const).map(([id, label, icon]) => <Pressable key={id} accessibilityRole="button" accessibilityLabel={label} aria-pressed={choice === id} accessibilityState={{ selected: choice === id }} disabled={saving} onPress={() => setChoice(id)} style={[s.choice, choice === id && s.choiceSelected]}><Icon name={icon} color="#dcfaff" size={22} /><Text style={s.choiceText}>{label}</Text><Text accessible={false} style={s.check}>{choice === id ? '✓' : '›'}</Text></Pressable>)}</View>}
      </ScrollView>
      <View style={s.footer}><View style={s.progress} accessibilityLabel={`Welcome step ${step + 1} of 3`}>{slides.map((_, index) => <View key={index} style={[s.dot, index === step && s.dotActive]} />)}</View><View style={s.controls}>{step > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Previous welcome step" disabled={saving} onPress={() => setStep(value => value - 1)} style={s.back}><Text style={s.backText}>Back</Text></Pressable>}<Pressable accessibilityRole="button" disabled={saving} accessibilityState={{ disabled: saving }} onPress={() => step < 2 ? setStep(value => value + 1) : void finish(choice)} style={s.continue}><Text style={s.continueText}>{saving ? 'Opening Zoi…' : step < 2 ? 'Continue' : 'Let’s go'}</Text><Icon name="arrow" color="#123d55" size={21} /></Pressable></View><Text style={s.privacy}>No location access is needed to explore.</Text></View>
    </SafeAreaView>
  </LinearGradient>;
}

const s = StyleSheet.create({
  frame: { flex: 1 }, safe: { flex: 1, width:'100%',maxWidth:780,alignSelf:'center', paddingTop:Platform.OS==='android'?NativeStatusBar.currentHeight||0:0 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b213c' },
  top: { paddingHorizontal: 24, paddingVertical: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 18 }, brand: { flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 30, height: 43 }, wordmark: { color: '#fff', fontSize: 25, fontWeight: '700', letterSpacing: -0.7 }, skip: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, skipText: { color: '#d0e9f1', fontSize: 14 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 27, gap: 20, paddingVertical: 24 }, symbol: { width: 82, height: 82, borderRadius: 28, backgroundColor: '#ffffff0c', borderWidth: 1, borderColor: '#b4ebfa44', justifyContent: 'center', alignItems: 'center', marginBottom: 10 }, eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.8, lineHeight: 17, color: '#b9f1fa' }, title: { fontSize: 48, lineHeight: 51, letterSpacing: -1.7, fontWeight: '700', color: '#fff' }, body: { fontSize: 16, lineHeight: 25, color: '#d0e9f1', maxWidth: 480 },
  choices: { gap: 9, marginTop: 4 }, choice: { minHeight: 56, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderRadius: 18, backgroundColor: '#ffffff08', borderWidth: 1, borderColor: '#b4ebfa33' }, choiceSelected: { backgroundColor: '#ffffff1f', borderColor: '#b4ebfa' }, choiceText: { color: '#f3fcff', fontSize: 14, lineHeight: 21, fontWeight: '600', flex: 1 }, check: { color: '#c3f8ff', fontSize: 20 },
  footer: { paddingHorizontal: 27, paddingBottom: 20, paddingTop: 10, gap: 14 }, progress: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingVertical: 6 }, dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ffffff55' }, dotActive: { width: 25, backgroundColor: '#c3f8ff' }, controls: { flexDirection: 'row', alignItems: 'center', gap: 15 }, back: { minHeight: 52, minWidth: 44, justifyContent: 'center', paddingHorizontal: 6 }, backText: { color: '#e0f7ff', fontSize: 14 }, continue: { flex: 1, minHeight: 56, paddingVertical: 15, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 15, borderRadius: 19, backgroundColor: '#f4fdff' }, continueText: { color: '#123d55', fontSize: 16, fontWeight: '700', flexShrink: 1 }, privacy: { color: '#c1dfe9', textAlign: 'center', fontSize: 11, lineHeight: 18 },
});
