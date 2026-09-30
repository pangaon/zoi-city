import { TimekeepingPanel } from './src/Timekeeping';
import { CreatorStudio, CreatorCustomerScreen } from './src/CreatorStudio';
import { profileImageMode } from './src/profile';
import { InquiriesScreen, InquiryInbox } from './src/Inquiries';
import { inquiryId } from './src/inquiries';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, Linking, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { AuthProvider } from './src/Auth';
import { AccountPanel, CommunityComposer } from './src/Account';
import { VenueStudio } from './src/Venue';
import { BusinessProfile } from './src/Profile';
import { OperationsPanel } from './src/Operations';
import { TicketsScreen } from './src/Tickets';
import { CreatorPanel } from './src/Creator';
import { BusinessEditor } from './src/BusinessEditor';
import { BookingOperator } from './src/BookingOperator';
import { VolunteerScreen, OrganizationOperator } from './src/Volunteer';
import { organizationId } from './src/volunteer';
import { PrioritiesPanel } from './src/Priorities';
import { DocumentsPanel } from './src/Documents';

const WEB = 'https://www.zoi.city';
const API = 'https://csebihpaychdkanjjsmz.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
const C = { navy: '#132F46', blue: '#116CBA', sky: '#EAF4FB', cream: '#FAF8F3', gold: '#A77B32', muted: '#60717E', line: '#DFE6EB', white: '#FFFFFF' };
type Tab = 'home' | 'discover' | 'community' | 'tickets' | 'volunteer' | 'inquiries' | 'creator-work' | 'grow';
type Place = { id: string; name: string; slug: string; path?: string; entity_type?: string; description?: string; city?: string; country?: string; photo_url?: string; category?: string };
type Post = { id: string; author?: string; body?: string; created_at?: string; media_photo?: string; likes?: number; comments?: number };

async function rpc<T>(name: string, body: Record<string, unknown>, signal: AbortSignal): Promise<T[]> {
  const response = await fetch(API + name, { method: 'POST', signal, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error('We could not load this right now. Please try again.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('We could not load this right now. Please try again.');
  return data;
}

function useRemote<T>(name: string, body: Record<string, unknown>) {
  const key = JSON.stringify(body);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, refresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    let expired = false;
    const timeout = setTimeout(() => { expired = true; controller.abort(); }, 15000);
    setLoading(true); setError(''); setRows([]);
    rpc<T>(name, JSON.parse(key), controller.signal).then(data => {
      if (active) setRows(data);
    }).catch(() => {
      if (active) setError(expired ? 'This is taking longer than expected. Please try again.' : 'We could not load this right now. Check your connection and try again.');
    }).finally(() => { clearTimeout(timeout); if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [name, key, version]);
  return { rows, loading, error, reload: () => refresh(v => v + 1) };
}

function Button({ label, onPress, subtle = false }: { label: string; onPress: () => void; subtle?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.button, subtle && s.buttonSubtle, pressed && s.pressed]}><Text style={[s.buttonLabel, subtle && s.buttonLabelSubtle]}>{label}</Text></Pressable>;
}
function RemoteState({ loading, error, empty, onRetry }: { loading: boolean; error: string; empty: boolean; onRetry: () => void }) {
  if (loading) return <View style={s.state} accessibilityLiveRegion="polite"><ActivityIndicator color={C.blue} /><Text style={s.body}>Loading from Zoi…</Text></View>;
  if (error) return <View style={s.state} accessibilityRole="alert"><Text style={s.body}>{error}</Text><Button label="Try again" onPress={onRetry} subtle /></View>;
  if (empty) return <View style={s.state}><Text style={s.cardTitle}>Nothing here yet</Text><Text style={s.body}>Try a different search, or check back for new additions.</Text></View>;
  return null;
}
function Photo({ uri, name }: { uri?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const [fit,setFit]=useState<'center'|'cover'>('center');
  useEffect(() => {setFailed(false);setFit('center');}, [uri]);
  if (!uri || !/^https:\/\//i.test(uri) || failed) return <View style={s.photoFallback}><Text style={s.monogram}>{name.slice(0, 1).toLocaleUpperCase()}</Text><Text style={s.photoLabel}>ZOI · DISCOVER</Text></View>;
  return <Image accessibilityLabel={name} source={{ uri }} resizeMode={fit} onLoad={event=>setFit(profileImageMode(event.nativeEvent.source.width,event.nativeEvent.source.height))} style={s.photo} onError={() => setFailed(true)} />;
}
function PlaceCard({ place, open }: { place: Place; open: (path: string) => void }) {
  const path = place.path && /^\/(?!\/)/.test(place.path) ? place.path : '/p/' + encodeURIComponent(place.slug);
  return <Pressable accessibilityRole="link" accessibilityLabel={`View ${place.name} profile`} onPress={() => open(path)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <Photo uri={place.photo_url} name={place.name} />
    <View style={s.cardContent}><Text style={s.eyebrow}>{(typeof place.category === 'string' ? place.category : place.entity_type || 'Discover').replaceAll('_', ' ')}</Text><Text style={s.cardTitle}>{place.name}</Text><Text style={s.meta}>{[place.city, place.country].filter(Boolean).join(' · ') || 'Greek connections worldwide'}</Text>{place.description ? <Text style={s.body} numberOfLines={3}>{place.description}</Text> : null}<Text style={s.textLink}>View profile →</Text></View>
  </Pressable>;
}
function Home({ navigate, open }: { navigate: (tab: Tab) => void; open: (path: string) => void }) {
  const data = useRemote<Place>('explore_search', { p_q: '', p_limit: 4 });
  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} tintColor={C.blue} />}>
    <View style={s.hero}><Text style={s.eyebrow}>ROOTED IN GREECE. OPEN TO THE WORLD.</Text><Text style={s.heroTitle}>Your world.{ '\n' }Your people.{ '\n' }Your Zoi.</Text><Text style={s.heroBody}>A place to belong, discover Greek businesses, and build what comes next.</Text><Button label="Find your Greek connection →" onPress={() => navigate('discover')} /><View style={s.heroRule} /><Text style={s.heroFooter}>ζωή / zoí / life</Text></View>
    <Text style={s.sectionTitle}>Make yourself at home</Text>
    <View style={s.tiles}>
      <Pressable accessibilityRole="button" onPress={() => navigate('community')} style={s.tile}><Text style={s.tileNumber}>01 / CONNECT</Text><Text style={s.cardTitle}>Our community</Text><Text style={s.body}>Stories and conversations from Greeks around the world.</Text><Text style={s.textLink}>Come on in →</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigate('grow')} style={[s.tile, s.tileBlue]}><Text style={s.tileNumber}>02 / BUILD</Text><Text style={s.cardTitle}>Your next chapter</Text><Text style={s.body}>Bring your business, your ideas, and your ambition.</Text><Text style={s.textLink}>Explore your workspace →</Text></Pressable>
    </View>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Discover the community</Text><Pressable accessibilityRole="button" onPress={() => navigate('discover')}><Text style={s.textLink}>See all →</Text></Pressable></View>
    <RemoteState {...data} empty={!data.rows.length} onRetry={data.reload} />
    {data.rows.map(place => <PlaceCard key={place.id} place={place} open={open} />)}
    <View style={s.shop}><Text style={s.eyebrow}>BUY GREEK. GO GLOBAL.</Text><Text style={s.sectionTitle}>A little closer to home.</Text><Text style={s.body}>Explore BuyGreek and support Greek makers and merchants.</Text><Button label="Visit BuyGreek.shop ↗" onPress={() => open('https://buygreek.shop')} subtle /></View>
  </ScrollView>;
}
function Discover({ open }: { open: (path: string) => void }) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const data = useRemote<Place>('explore_search', { p_q: query, p_limit: 24, ...(type ? { p_type: type } : {}) });
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    <Text style={s.eyebrow}>THE GREEK WORLD, CONNECTED</Text><Text style={s.pageTitle}>Find your people.{ '\n' }Find your place.</Text><Text style={s.body}>Search businesses, professionals and community spaces.</Text>
    <View style={s.searchRow}><TextInput accessibilityLabel="Search Greek businesses and places" placeholder="Name, city or keyword" placeholderTextColor={C.muted} value={input} onChangeText={setInput} returnKeyType="search" onSubmitEditing={() => setQuery(input.trim())} style={s.input} /><Button label="Search" onPress={() => setQuery(input.trim())} /></View>
    <View style={s.chips}>{[['', 'All'], ['business', 'Businesses'], ['professional', 'Professionals'], ['church', 'Churches']].map(([value, label]) => <Pressable accessibilityRole="button" aria-pressed={type === value} accessibilityState={{ selected: type === value }} key={value} onPress={() => setType(value)} style={[s.chip, type === value && s.chipActive]}><Text style={[s.chipText, type === value && s.chipActiveText]}>{label}</Text></Pressable>)}</View>
    <RemoteState {...data} empty={!data.rows.length} onRetry={data.reload} />
    {!data.loading && !data.error && data.rows.length > 0 ? <Text style={s.meta}>{data.rows.length} results{data.rows.length === 24 ? ' · refine your search to find more' : ''}</Text> : null}
    {data.rows.map(place => <PlaceCard key={place.id} place={place} open={open} />)}
  </ScrollView>;
}
function Community({ open, volunteer }: { open: (path: string) => void; volunteer: () => void }) {
  const data = useRemote<Post>('feed_list', { p_limit: 20, p_offset: 0 });
  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} />}>
    <Text style={s.eyebrow}>WHEREVER WE ARE, WE BELONG</Text><Text style={s.pageTitle}>The conversation{ '\n' }starts here.</Text><Text style={s.body}>The latest stories shared with the Zoi community.</Text>
    <Button label="Your private enquiries →" onPress={() => open('/inquiries/')} /><Button label="Volunteer with your community →" onPress={volunteer} /><CommunityComposer onPublished={data.reload} /><Button label="Open community website ↗" onPress={() => open('/community')} /><Text style={s.meta}>Read and publish here. Replies and media uploads open the Zoi website.</Text>
    <RemoteState {...data} empty={!data.rows.length} onRetry={data.reload} />
    {data.rows.map(post => <View key={post.id} style={s.post}><View style={s.postHead}><View style={s.avatar}><Text style={s.avatarText}>{(post.author || 'Zoi').slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={s.cardTitle}>{post.author || 'Community member'}</Text>{post.created_at && !Number.isNaN(Date.parse(post.created_at)) ? <Text style={s.meta}>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text> : null}</View></View><Text style={s.postBody}>{post.body || ''}</Text>{post.media_photo ? <Photo uri={post.media_photo} name="Community photo" /> : null}<Pressable accessibilityRole="link" onPress={() => open('/community#post-' + encodeURIComponent(post.id))}><Text style={s.textLink}>Read and respond ↗</Text></Pressable></View>)}
  </ScrollView>;
}
function Grow({ open }: { open: (path: string) => void }) {
  const links = [
    { label: 'Your business workspace', text: 'Manage your profile, content and customer relationships.', path: '/social', tag: 'CREATE & GROW' },
    { label: 'Bring people together', text: 'Explore events and manage your tickets on Zoi.', path: '/tickets', tag: 'EVENTS & TICKETS' },
    { label: 'BuyGreek', text: 'Connect with Greek products and merchants.', path: 'https://buygreek.shop', tag: 'COMMERCE' },
    { label: 'Your account', text: 'Sign in to your existing Zoi account securely.', path: '/social', tag: 'YOUR ZOI' },
  ];
  return <ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>MADE FOR YOUR NEXT CHAPTER</Text><Text style={s.pageTitle}>Greek roots.{ '\n' }Global ambition.</Text><Text style={s.body}>Your work deserves a home in the Greek world.</Text><AccountPanel /><Button label="Your private enquiries →" onPress={() => open('/inquiries/')} /><InquiryInbox /><Button label="Your shared creator work →" onPress={() => open('/creator/')} /><CreatorStudio /><PrioritiesPanel /><CreatorPanel /><BusinessEditor /><OperationsPanel /><TimekeepingPanel /><DocumentsPanel /><BookingOperator /><OrganizationOperator /><VenueStudio /><View style={s.note}><Text style={s.body}>Explore additional services below. Connected provider availability is shown inside each workspace.</Text></View>{links.map(link => <View key={link.tag} style={s.workspace}><Text style={s.eyebrow}>{link.tag}</Text><Text style={s.sectionTitle}>{link.label}</Text><Text style={s.body}>{link.text}</Text><Button label="Open workspace ↗" onPress={() => open(link.path)} subtle /></View>)}<Text style={s.meta}>Use the workspace tools above. Paid checkout and additional connected services open on the website.</Text></ScrollView>;
}
function ZoiApp() {
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [volunteerWorkspace, setVolunteerWorkspace] = useState('');
  const [enquiry, setEnquiry] = useState({listing:'',thread:''});
  const [creatorCampaign,setCreatorCampaign]=useState('');
  const [eventId, setEventId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    const handleLink = (url: string | null) => {
      if (!url || !url.startsWith('zoi://')) return;
      if (/^zoi:\/\/creator\/?(?:[?#]|$)/.test(url)) {setCreatorCampaign(inquiryId(new URL(url).searchParams.get('campaign')));setProfileSlug(null);setTab('creator-work');return;}
      if (/^zoi:\/\/inquiries(?:[/?#]|$)/.test(url)) { const link=new URL(url); setEnquiry({listing:inquiryId(link.searchParams.get('listing')),thread:inquiryId(link.searchParams.get('thread'))});setProfileSlug(null);setTab('inquiries');return; }
      if (url.startsWith('zoi://volunteer')) { setVolunteerWorkspace(organizationId(url)); setProfileSlug(null); setTab('volunteer'); return; }
      if (url.startsWith('zoi://tickets')) { const id = url.slice(14).replace(/^\//, '').split(/[?#]/)[0]; setEventId(/^[0-9a-f-]{36}$/i.test(id) ? id : null); setProfileSlug(null); setTab('tickets'); return; }
      const detail = /^zoi:\/\/(?:p|business|professional|church|organization|creator|artist|school|venue|vendor|event|sports|travel-place)\/([^/?#]+)$/.exec(url);
      if (detail) { try { setProfileSlug(decodeURIComponent(detail[1])); } catch {} return; }
      setProfileSlug(null);
      const route = url.slice(6).split(/[/?#]/)[0];
      if (['home', 'discover', 'community', 'grow'].includes(route)) setTab(route as Tab);
    };
    Linking.getInitialURL().then(handleLink).catch(() => {});
    const subscription = Linking.addEventListener('url', event => handleLink(event.url));
    return () => subscription.remove();
  }, []);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const open = async (path: string) => {
    setLinkError('');
    if (/^\/creator\/?(?:[?#]|$)/.test(path)) {setCreatorCampaign(inquiryId(new URL(path,WEB).searchParams.get('campaign')));setProfileSlug(null);setTab('creator-work');return;}
    if (/^\/inquiries(?:[/?#]|$)/.test(path)) { const link=new URL(path,WEB);setEnquiry({listing:inquiryId(link.searchParams.get('listing')),thread:inquiryId(link.searchParams.get('thread'))});setProfileSlug(null);setTab('inquiries');return; }
    if (/^\/volunteer(?:[/?#]|$)/.test(path)) { setVolunteerWorkspace(organizationId(new URL(path, WEB).href)); setProfileSlug(null); setTab('volunteer'); return; }
    if (/^\/tickets(?:[?#]|$)/.test(path)) { setEventId(new URL(path, WEB).searchParams.get('e')); setProfileSlug(null); setTab('tickets'); return; }
    const profileMatch = /^\/(?:p|business|professional|church|organization|creator|artist|school|venue|vendor|event|sports|travel-place)\/([^/?#]+)$/.exec(path);
    if (profileMatch) { try { setProfileSlug(decodeURIComponent(profileMatch[1])); } catch { setLinkError('This profile link is not valid.'); } return; }
    const url = path.startsWith('/') && !path.startsWith('//') ? WEB + path : path;
    if (!/^https:\/\/(www\.zoi\.city|buygreek\.shop)(\/|$)/.test(url)) { setLinkError('This link is not available. Please try the Zoi website.'); return; }
    try { await Linking.openURL(url); } catch { if (mounted.current) setLinkError('We could not open your browser. Please try again.'); }
  };
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.shell}><View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Zoi home" onPress={() => { setProfileSlug(null); setTab('home'); }}><Text style={s.wordmark}>zoi<Text style={s.wordmarkDot}>.</Text></Text></Pressable><Text style={s.headerTag}>GREEK ROOTS.{ '\n' }GLOBAL LIFE.</Text><Pressable accessibilityRole="link" accessibilityLabel="Your Zoi account" onPress={() => { setProfileSlug(null); setTab('grow'); }} style={s.account}><Text style={s.accountText}>Your Zoi ↗</Text></Pressable></View>{linkError ? <View style={s.error} accessibilityRole="alert"><Text style={s.body}>{linkError}</Text><Button label="Dismiss" onPress={() => setLinkError('')} subtle /></View> : null}<View style={s.screen}>{profileSlug ? <BusinessProfile enquiry={listing => { setEnquiry({listing,thread:''});setProfileSlug(null);setTab('inquiries'); }} volunteer={workspace => { setVolunteerWorkspace(workspace); setProfileSlug(null); setTab('volunteer'); }} slug={profileSlug} back={() => setProfileSlug(null)} signIn={() => { setProfileSlug(null); setTab('grow'); }} /> : tab === 'home' ? <Home navigate={setTab} open={open} /> : tab === 'discover' ? <Discover open={open} /> : tab === 'community' ? <Community open={open} volunteer={() => setTab('volunteer')} /> : tab === 'creator-work' ? <CreatorCustomerScreen campaign={creatorCampaign} back={() => setTab('grow')} signIn={() => setTab('grow')} /> : tab === 'inquiries' ? <InquiriesScreen listing={enquiry.listing} thread={enquiry.thread} back={() => setTab('community')} signIn={() => setTab('grow')} /> : tab === 'volunteer' ? <VolunteerScreen workspace={volunteerWorkspace} choose={setVolunteerWorkspace} back={() => setTab('community')} signIn={() => setTab('grow')} /> : tab === 'tickets' ? <TicketsScreen eventId={eventId} chooseEvent={setEventId} signIn={() => setTab('grow')} /> : <Grow open={open} />}</View><View style={s.nav}>{([{ id: 'home', icon: '⌂', label: 'Home' }, { id: 'discover', icon: '◎', label: 'Discover' }, { id: 'community', icon: '☷', label: 'Community' }, { id: 'tickets', icon: '◇', label: 'Events' }, { id: 'grow', icon: '↗', label: 'Grow' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" aria-selected={tab === item.id} accessibilityState={{ selected: tab === item.id }} onPress={() => { setLinkError(''); setProfileSlug(null); setTab(item.id); }} style={[s.navItem, tab === item.id && s.navSelected]}><Text style={[s.navIcon, tab === item.id && s.navActive]}>{item.icon}</Text><Text style={[s.navLabel, tab === item.id && s.navActive]}>{item.label}</Text></Pressable>)}</View></View></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream, paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight || 0 : 0 }, shell: { flex: 1, width: '100%', maxWidth: 780, alignSelf: 'center' }, screen: { flex: 1 },
  header: { paddingHorizontal: 22, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.white, borderBottomColor: C.line, borderBottomWidth: 1 }, wordmark: { fontSize: 40, letterSpacing: -3, fontWeight: '800', color: C.navy }, wordmarkDot: { color: C.gold }, headerTag: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, lineHeight: 15, color: C.muted, flex: 1 }, account: { minHeight: 44, justifyContent: 'center' }, accountText: { color: C.blue, fontWeight: '700', fontSize: 13 },
  content: { padding: 22, gap: 20, paddingBottom: 32 }, hero: { padding: 26, backgroundColor: C.sky, borderRadius: 24, gap: 22 }, eyebrow: { fontSize: 10, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: C.gold, textTransform: 'uppercase' }, heroTitle: { fontSize: 48, lineHeight: 52, fontWeight: '700', letterSpacing: -2, color: C.navy }, heroBody: { color: C.navy, fontSize: 17, lineHeight: 26 }, heroRule: { height: 1, backgroundColor: '#C7DDEB' }, heroFooter: { fontSize: 13, color: C.muted, letterSpacing: 2 },
  pageTitle: { color: C.navy, fontSize: 36, lineHeight: 42, letterSpacing: -1.2, fontWeight: '700' }, sectionTitle: { color: C.navy, fontSize: 24, lineHeight: 30, letterSpacing: -0.7, fontWeight: '700' }, cardTitle: { color: C.navy, fontSize: 20, lineHeight: 27, fontWeight: '700' }, body: { color: C.muted, fontSize: 15, lineHeight: 24 }, meta: { color: C.muted, fontSize: 12, lineHeight: 19 }, textLink: { color: C.blue, fontWeight: '700', fontSize: 14, paddingVertical: 10 },
  button: { minHeight: 48, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, buttonSubtle: { backgroundColor: C.sky }, buttonLabel: { color: C.white, fontWeight: '700', fontSize: 14 }, buttonLabelSubtle: { color: C.blue }, pressed: { opacity: 0.75 }, tiles: { gap: 14 }, tile: { padding: 22, gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 18 }, tileBlue: { backgroundColor: '#F1F6FA' }, tileNumber: { color: C.gold, fontSize: 10, letterSpacing: 2, fontWeight: '700' }, sectionHead: { gap: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }, cardContent: { padding: 20, gap: 8 }, photo: { width: '100%', height: 190 }, photoFallback: { height: 150, backgroundColor: '#E6EFF0', alignItems: 'center', justifyContent: 'center', gap: 12 }, monogram: { color: '#416D7D', fontSize: 56, fontWeight: '300' }, photoLabel: { color: '#416D7D', fontSize: 9, letterSpacing: 3 }, shop: { backgroundColor: '#F2EADB', padding: 24, borderRadius: 20, gap: 16 }, state: { padding: 24, alignItems: 'center', gap: 16, backgroundColor: C.white, borderRadius: 16 }, searchRow: { flexDirection: 'row', gap: 10 }, input: { flex: 1, minWidth: 0, minHeight: 50, borderColor: C.line, borderWidth: 1, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: C.navy }, chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, backgroundColor: C.white, borderColor: C.line, borderWidth: 1 }, chipActive: { backgroundColor: C.navy, borderColor: C.navy }, chipText: { color: C.muted, fontSize: 13 }, chipActiveText: { color: C.white },
  post: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 20, gap: 18 }, postHead: { flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.sky, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: C.blue, fontWeight: '700', fontSize: 20 }, postBody: { fontSize: 16, lineHeight: 26, color: C.navy }, workspace: { backgroundColor: C.white, padding: 24, borderWidth: 1, borderColor: C.line, borderRadius: 18, gap: 16 }, note: { borderLeftWidth: 3, borderLeftColor: C.gold, paddingLeft: 16 }, error: { padding: 16, backgroundColor: '#FFF0DF', gap: 10 },
  nav: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 8, paddingTop: 8, paddingBottom: Platform.OS === 'android' ? 22 : 8 }, navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12 }, navSelected: { backgroundColor: C.sky }, navIcon: { fontSize: 24, color: C.muted }, navLabel: { fontSize: 11, fontWeight: '600', color: C.muted }, navActive: { color: C.blue },
});

export default function App() { return <AuthProvider><ZoiApp /></AuthProvider>; }
