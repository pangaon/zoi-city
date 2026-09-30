import{placeDestination}from'./src/placeNavigation';
import{nativeWebHandoff}from'./src/webHandoffs';
import{SHELL as C,LIGHT}from'./src/brand';
import {CommunityScreen} from './src/Community';
import {EventPlannerScreen} from './src/EventPlanner';
import {TripsScreen,AppearanceOperator} from './src/Trips';
import {GlassHero,Reveal} from './src/Presentation';
import {FestivalOperator,FestivalScreen} from './src/Festival';
import {GroupsOperator,GroupMemberScreen} from './src/Groups';
import {OrganizationCalendarOperator,OrganizationCalendarPublic} from './src/OrganizationCalendar';
import {ShopScreen} from './src/Shop';
import {shopLink} from './src/commerce';
import { TimekeepingPanel } from './src/Timekeeping';
import { CreatorStudio, CreatorCustomerScreen } from './src/CreatorStudio';
import { profileImageEventMode } from './src/profile';
import { InquiriesScreen, InquiryInbox } from './src/Inquiries';
import { inquiryId } from './src/inquiries';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, Linking, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar as NativeStatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { AuthProvider, useAuth } from './src/Auth';
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
type Tab = 'home' | 'discover' | 'community' | 'tickets' | 'volunteer' | 'inquiries' | 'creator-work' | 'shop' | 'calendar' | 'groups' | 'festival' | 'trips' | 'event-plan' | 'grow';
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
  return <Image accessibilityLabel={name} source={{ uri }} resizeMode={fit} onLoad={event=>setFit(profileImageEventMode(event))} style={s.photo} onError={() => setFailed(true)} />;
}
function PlaceCard({ place, open }: { place: Place; open: (path: string) => void }) {
  const path = placeDestination(place);
  if(!path)return null;
  return <Pressable accessibilityRole="link" accessibilityLabel={`View ${place.name} profile`} onPress={() => open(path)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
    <Photo uri={place.photo_url} name={place.name} />
    <View style={s.cardContent}><Text style={s.eyebrow}>{(typeof place.category === 'string' ? place.category : place.entity_type || 'Discover').replaceAll('_', ' ')}</Text><Text style={s.cardTitle}>{place.name}</Text><Text style={s.meta}>{[place.city, place.country].filter(Boolean).join(' · ') || 'Greek connections worldwide'}</Text>{place.description ? <Text style={s.body} numberOfLines={3}>{place.description}</Text> : null}<Text style={s.textLink}>View profile →</Text></View>
  </Pressable>;
}
function Home({ navigate, open }: { navigate: (tab: Tab) => void; open: (path: string) => void }) {
  const data = useRemote<Place>('explore_search', { p_q: '', p_limit: 4 });
  return <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={data.loading} onRefresh={data.reload} tintColor={C.blue} />}>
    <GlassHero><Text style={s.eyebrow}>ROOTED IN GREECE. OPEN TO THE WORLD.</Text><Text style={s.heroTitle}>Your world.{ '\n' }Your people.{ '\n' }Your Zoi.</Text><Text style={s.heroBody}>Greek life, wherever you are. Find your people, discover something remarkable, and build your next chapter.</Text><Button label="Find your Greek connection →" onPress={() => navigate('discover')} /><Pressable accessibilityRole="button" onPress={()=>open('/shop/')} style={s.heroShop}><Text style={s.textLink}>Shop BuyGreek · made for home →</Text></Pressable><View style={s.heroRule} /><Text style={s.heroFooter}>ζωή / zoí / life</Text></GlassHero>
    <Text style={s.sectionTitle}>Make yourself at home</Text>
    <View style={s.tiles}>
      <Pressable accessibilityRole="button" onPress={() => navigate('community')} style={s.tile}><Text style={s.tileNumber}>01 / CONNECT</Text><Text style={s.cardTitle}>Our community</Text><Text style={s.body}>Stories and conversations from Greeks around the world.</Text><Text style={s.textLink}>Come on in →</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => navigate('grow')} style={[s.tile, s.tileBlue]}><Text style={s.tileNumber}>02 / BUILD</Text><Text style={s.cardTitle}>Your next chapter</Text><Text style={s.body}>Bring your business, your ideas, and your ambition.</Text><Text style={s.textLink}>Explore your workspace →</Text></Pressable>
    </View>
    <View style={s.sectionHead}><Text style={s.sectionTitle}>Discover the community</Text><Pressable accessibilityRole="button" onPress={() => navigate('discover')}><Text style={s.textLink}>See all →</Text></Pressable></View>
    <RemoteState {...data} empty={!data.rows.length} onRetry={data.reload} />
    {data.rows.map(place => <PlaceCard key={place.id} place={place} open={open} />)}
    <View style={s.shop}><Text style={s.eyebrow}>BUY GREEK. GO GLOBAL.</Text><Text style={s.sectionTitle}>A little closer to home.</Text><Text style={s.body}>Explore BuyGreek and support Greek makers and merchants.</Text><Button label="Shop BuyGreek →" onPress={() => open('/shop/')} subtle /></View>
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

function Grow({ open }: { open: (path: string) => void }) {
  const [category,setCategory]=useState('All'),[selected,setSelected]=useState('');
  const {session,workspaceId}=useAuth();
  const tools=[
    {id:'appearances',category:'Create',title:'Confirmed artist appearances',text:'Agree exact show dates between artist and event owners.',node:<AppearanceOperator/>},
    {id:'priorities',category:'Business',title:'Today’s priorities',text:'Review real tasks, bookings and publishing issues.',node:<PrioritiesPanel/>},
    {id:'operations',category:'Business',title:'Business operations',text:'Companies, contacts, projects, matters and tasks.',node:<OperationsPanel/>},
    {id:'time',category:'Business',title:'Time and approvals',text:'Private work records, server timers and timesheets.',node:<TimekeepingPanel/>},
    {id:'documents',category:'Business',title:'Private documents',text:'Secure project files, versions and access history.',node:<DocumentsPanel/>},
    {id:'bookings',category:'Business',title:'Bookings and availability',text:'Services, resources, schedules and customer reservations.',node:<BookingOperator/>},
    {id:'inbox',category:'Create',title:'Customer conversations',text:'Private enquiries, assignments and follow-up.',node:<InquiryInbox/>},
    {id:'creator',category:'Create',title:'Creator collaborations',text:'Sponsorships, performance briefs and client approvals.',node:<CreatorStudio/>},
    {id:'bio',category:'Create',title:'Your bio and links',text:'Create your public landing page and ordered links.',node:<CreatorPanel/>},
    {id:'profile',category:'Create',title:'Your public home',text:'Manage owned business and artist profiles.',node:<BusinessEditor/>},
    {id:'calendar',category:'Community',title:'Community calendar',text:'Services, rehearsals, classes and confirmed occasions.',node:<OrganizationCalendarOperator openPublic={listing=>open('/organization-calendar/?listing='+listing)}/>},
    {id:'groups',category:'Community',title:'Groups and membership',text:'Adult membership, private rosters and attendance.',node:<GroupsOperator openMembership={listing=>open('/groups/?listing='+listing)}/>},
    {id:'volunteer',category:'Community',title:'Volunteer programs',text:'Real shifts, signup capacity and private rosters.',node:<OrganizationOperator/>},
    {id:'festival',category:'Gather',title:'Festival sponsors and booths',text:'Offer packages, applications and capacity decisions.',node:<FestivalOperator openOffer={(host,offer)=>open('/festival/?event='+host+(offer?'&offer='+offer:''))} inquiry={thread=>open('/inquiries/?thread='+thread)}/>},
    {id:'venue',category:'Gather',title:'Venue draft studio',text:'Create and inspect a local seat-plan draft in 3D.',node:<VenueStudio/>},
  ];
  const tool=tools.find(t=>t.id===selected);
  if(tool)return <ScrollView key={tool.id} contentContainerStyle={s.content}><Button label="← All workspace tools" onPress={()=>setSelected('')} subtle/><Text style={s.eyebrow}>{tool.category}</Text><Text style={s.pageTitle}>{tool.title}</Text><Text style={s.body}>{tool.text}</Text>{selected==='venue'||(session&&workspaceId)?tool.node:<><Text style={s.body}>Sign in and choose your workspace to open this tool.</Text><AccountPanel/></>}</ScrollView>;
  return <ScrollView contentContainerStyle={s.content}><Text style={s.eyebrow}>YOUR AMBITION, AT HOME</Text><Text style={s.pageTitle}>Make your next{ '\n' }move count.</Text><Text style={s.body}>One workspace for the work, creativity and community you are building.</Text><AccountPanel/><View style={s.quickActions}><Button label="Plan an event" onPress={()=>open('/event-plan/')} subtle/><Button label="My private trips" onPress={()=>open('/trips/')} subtle/><Button label="My enquiries" onPress={()=>open('/inquiries/')} subtle/><Button label="Shared creator work" onPress={()=>open('/creator/')} subtle/><Button label="Festival applications" onPress={()=>open('/festival/')} subtle/><Button label="Shop BuyGreek" onPress={()=>open('/shop/')} subtle/></View><View style={s.chips}>{['All','Business','Create','Community','Gather'].map(value=><Pressable key={value} accessibilityRole="button" accessibilityState={{selected:category===value}} aria-pressed={category===value} style={[s.chip,category===value&&s.chipActive]} onPress={()=>{setCategory(value);setSelected('');}}><Text style={[s.chipText,category===value&&s.chipActiveText]}>{value}</Text></Pressable>)}</View><View style={s.toolGrid}>{tools.filter(t=>category==='All'||t.category===category).map((item,index)=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Open '+item.title} onPress={()=>setSelected(item.id)} style={({pressed})=>[s.toolCard,pressed&&s.pressed]}><View style={s.toolBadge}><Text style={s.toolBadgeText}>{String(index+1).padStart(2,'0')}</Text></View><Text style={s.cardTitle}>{item.title}</Text><Text style={s.body}>{item.text}</Text><Text style={s.textLink}>Open tool →</Text></Pressable>)}</View><View style={s.note}><Text style={s.body}>Manage additional website tools in your web workspace. External social connections and publishing depend on enabled integrations.</Text><Button label="Open web workspace ↗" onPress={()=>open('/social')} subtle/></View></ScrollView>;
}
function ZoiApp() {
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [volunteerWorkspace, setVolunteerWorkspace] = useState('');
  const [enquiry, setEnquiry] = useState({listing:'',thread:''});
  const [creatorCampaign,setCreatorCampaign]=useState('');
  const [shop,setShop]=useState({product:'',variant:''});
  const [calendarListing,setCalendarListing]=useState('');
  const [groupListing,setGroupListing]=useState('');
  const [communityLink,setCommunityLink]=useState({post:'',profile:''});
  const [tripArtist,setTripArtist]=useState('');
  const [festival,setFestival]=useState({event:'',offer:''});
  const [eventId, setEventId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState('');
  useEffect(() => {
    const handleLink = (url: string | null) => {
      if (!url || !url.startsWith('zoi://')) return;
      const handoff=nativeWebHandoff(url);if(handoff){void Linking.openURL(handoff).catch(()=>setLinkError('We could not open this web feature. Please try again.'));return;}
      if (/^zoi:\/\/community(?:[/?#]|$)/.test(url)){const u=new URL(url);setCommunityLink({post:inquiryId(u.searchParams.get('post')),profile:inquiryId(u.searchParams.get('profile'))});setProfileSlug(null);setTab('community');return;}
      if (/^zoi:\/\/event-plan(?:[/?#]|$)/.test(url)){setProfileSlug(null);setTab('event-plan');return;}
      if (/^zoi:\/\/trips(?:[/?#]|$)/.test(url)){setTripArtist(inquiryId(new URL(url).searchParams.get('artist')));setProfileSlug(null);setTab('trips');return;}
      if (/^zoi:\/\/festival(?:[/?#]|$)/.test(url)){const u=new URL(url);setFestival({event:inquiryId(u.searchParams.get('event')),offer:inquiryId(u.searchParams.get('offer'))});setProfileSlug(null);setTab('festival');return;}
      if (/^zoi:\/\/groups(?:[/?#]|$)/.test(url)){setGroupListing(inquiryId(new URL(url).searchParams.get('listing')));setProfileSlug(null);setTab('groups');return;}
      if (/^zoi:\/\/organization-calendar(?:[/?#]|$)/.test(url)){setCalendarListing(inquiryId(new URL(url).searchParams.get('listing')));setProfileSlug(null);setTab('calendar');return;}
      if (/^zoi:\/\/shop(?:[/?#]|$)/.test(url)){setShop(shopLink(url));setProfileSlug(null);setTab('shop');return;}
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
    const handoff=nativeWebHandoff(path);if(handoff){try{await Linking.openURL(handoff)}catch{setLinkError('We could not open this web feature. Please try again.')}return;}
    if (/^\/community(?:[/?#]|$)/.test(path)){const u=new URL(path,WEB);setCommunityLink({post:inquiryId(u.searchParams.get('post')),profile:inquiryId(u.searchParams.get('profile'))});setProfileSlug(null);setTab('community');return;}
    if (/^\/event-plan(?:[/?#]|$)/.test(path)){setProfileSlug(null);setTab('event-plan');return;}
    if (/^\/trips(?:[/?#]|$)/.test(path)){setTripArtist(inquiryId(new URL(path,WEB).searchParams.get('artist')));setProfileSlug(null);setTab('trips');return;}
    if (/^\/festival(?:[/?#]|$)/.test(path)){const u=new URL(path,WEB);setFestival({event:inquiryId(u.searchParams.get('event')),offer:inquiryId(u.searchParams.get('offer'))});setProfileSlug(null);setTab('festival');return;}
    if (/^\/groups(?:[/?#]|$)/.test(path)){setGroupListing(inquiryId(new URL(path,WEB).searchParams.get('listing')));setProfileSlug(null);setTab('groups');return;}
    if (/^\/organization-calendar(?:[/?#]|$)/.test(path)){setCalendarListing(inquiryId(new URL(path,WEB).searchParams.get('listing')));setProfileSlug(null);setTab('calendar');return;}
    if (/^\/shop(?:[/?#]|$)/.test(path)){setShop(shopLink(path));setProfileSlug(null);setTab('shop');return;}
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
  return <SafeAreaView style={s.safe}><StatusBar style="dark" /><View style={s.shell}><View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Zoi home" onPress={() => { setProfileSlug(null); setTab('home'); }}><Text style={s.wordmark}>zoi<Text style={s.wordmarkDot}>.</Text></Text></Pressable><Text style={s.headerTag}>GREEK ROOTS.{ '\n' }GLOBAL LIFE.</Text><Pressable accessibilityRole="link" accessibilityLabel="Your Zoi account" onPress={() => { setProfileSlug(null); setTab('grow'); }} style={s.account}><Text style={s.accountText}>Your Zoi ↗</Text></Pressable></View>{linkError ? <View style={s.error} accessibilityRole="alert"><Text style={s.body}>{linkError}</Text><Button label="Dismiss" onPress={() => setLinkError('')} subtle /></View> : null}<View style={s.screen}><Reveal trigger={profileSlug||tab}>{profileSlug ? <BusinessProfile shows={artist=>{setTripArtist(artist);setProfileSlug(null);setTab('trips');}} festival={event=>{setFestival({event,offer:''});setProfileSlug(null);setTab('festival');}} group={listing=>{setGroupListing(listing);setProfileSlug(null);setTab('groups');}} calendar={listing=>{setCalendarListing(listing);setProfileSlug(null);setTab('calendar');}} enquiry={listing => { setEnquiry({listing,thread:''});setProfileSlug(null);setTab('inquiries'); }} volunteer={workspace => { setVolunteerWorkspace(workspace); setProfileSlug(null); setTab('volunteer'); }} slug={profileSlug} back={() => setProfileSlug(null)} signIn={() => { setProfileSlug(null); setTab('grow'); }} /> : tab === 'home' ? <Home navigate={setTab} open={open} /> : tab === 'discover' ? <Discover open={open} /> : tab === 'community' ? <CommunityScreen open={open} signIn={()=>setTab('grow')} initialPost={communityLink.post} initialProfile={communityLink.profile}/> : tab === 'event-plan' ? <EventPlannerScreen back={()=>setTab('grow')} signIn={()=>setTab('grow')}/> : tab === 'trips' ? <TripsScreen initialArtistId={tripArtist} back={()=>setTab('discover')} signIn={()=>setTab('grow')} open={open}/> : tab === 'festival' ? <FestivalScreen event={festival.event} offer={festival.offer} back={()=>setTab('community')} signIn={()=>setTab('grow')} inquiry={thread=>{setEnquiry({listing:'',thread});setTab('inquiries');}} /> : tab === 'groups' ? <GroupMemberScreen listing={groupListing} back={()=>setTab('community')} calendar={()=>{setCalendarListing(groupListing);setTab('calendar');}} signIn={()=>setTab('grow')} /> : tab === 'calendar' ? <OrganizationCalendarPublic key={calendarListing} listing={calendarListing} back={()=>setTab('community')} volunteer={workspace=>{setVolunteerWorkspace(workspace);setTab('volunteer');}} /> : tab === 'shop' ? <ShopScreen key={shop.product+':'+shop.variant} initialProduct={shop.product} initialVariant={shop.variant} back={()=>setTab('home')} /> : tab === 'creator-work' ? <CreatorCustomerScreen campaign={creatorCampaign} back={() => setTab('grow')} signIn={() => setTab('grow')} /> : tab === 'inquiries' ? <InquiriesScreen listing={enquiry.listing} thread={enquiry.thread} back={() => setTab('community')} signIn={() => setTab('grow')} /> : tab === 'volunteer' ? <VolunteerScreen workspace={volunteerWorkspace} choose={setVolunteerWorkspace} back={() => setTab('community')} signIn={() => setTab('grow')} /> : tab === 'tickets' ? <TicketsScreen eventId={eventId} chooseEvent={setEventId} signIn={() => setTab('grow')} /> : <Grow open={open} />}</Reveal></View><View style={s.nav}>{([{ id: 'home', icon: '⌂', label: 'Home' }, { id: 'discover', icon: '◎', label: 'Discover' }, { id: 'community', icon: '☷', label: 'Community' }, { id: 'tickets', icon: '◇', label: 'Events' }, { id: 'grow', icon: '↗', label: 'Grow' }] as const).map(item => <Pressable key={item.id} accessibilityRole="tab" aria-selected={tab === item.id} accessibilityState={{ selected: tab === item.id }} onPress={() => { setLinkError(''); setProfileSlug(null); setTab(item.id); }} style={[s.navItem, tab === item.id && s.navSelected]}><Text style={[s.navIcon, tab === item.id && s.navActive]}>{item.icon}</Text><Text style={[s.navLabel, tab === item.id && s.navActive]}>{item.label}</Text></Pressable>)}</View></View></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.cream, paddingTop: Platform.OS === 'android' ? NativeStatusBar.currentHeight || 0 : 0 }, shell: { flex: 1, width: '100%', maxWidth: 780, alignSelf: 'center' }, screen: { flex: 1 },
  header: { paddingHorizontal: 22, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.white, borderBottomColor: C.line, borderBottomWidth: 1 }, wordmark: { fontSize: 40, letterSpacing: -3, fontWeight: '800', color: C.navy }, wordmarkDot: { color: C.gold }, headerTag: { fontSize: 9, fontWeight: '700', letterSpacing: 1.5, lineHeight: 15, color: C.muted, flex: 1 }, account: { minHeight: 44, justifyContent: 'center' }, accountText: { color: C.blue, fontWeight: '700', fontSize: 13 },
  quickActions:{flexDirection:'row',flexWrap:'wrap',gap:8},toolGrid:{gap:14},toolCard:{padding:22,gap:10,backgroundColor:LIGHT.surface,borderRadius:20,borderWidth:1,borderColor:LIGHT.line,boxShadow:'0 6px 22px rgba(19,47,70,0.035)'},toolBadge:{width:36,height:36,borderRadius:12,backgroundColor:LIGHT.surfaceRaised,justifyContent:'center',alignItems:'center'},toolBadgeText:{fontWeight:'700',color:LIGHT.accent,fontSize:11}, content: { padding: 22, gap: 20, paddingBottom: 32 }, hero: { padding: 26, backgroundColor: C.sky, borderRadius: 24, gap: 22 }, eyebrow: { fontSize: 10, lineHeight: 17, fontWeight: '800', letterSpacing: 1.5, color: C.gold, textTransform: 'uppercase' }, heroTitle: { fontSize: 48, lineHeight: 52, fontWeight: '700', letterSpacing: -2, color: C.navy }, heroBody: { color: C.navy, fontSize: 17, lineHeight: 26 }, heroShop:{borderTopWidth:1,borderTopColor:'#FFFFFFAA',paddingTop:4}, heroRule: { height: 1, backgroundColor: LIGHT.line }, heroFooter: { fontSize: 13, color: C.muted, letterSpacing: 2 },
  pageTitle: { color: C.navy, fontSize: 36, lineHeight: 42, letterSpacing: -1.2, fontWeight: '700' }, sectionTitle: { color: C.navy, fontSize: 24, lineHeight: 30, letterSpacing: -0.7, fontWeight: '700' }, cardTitle: { color: C.navy, fontSize: 20, lineHeight: 27, fontWeight: '700' }, body: { color: C.muted, fontSize: 15, lineHeight: 24 }, meta: { color: C.muted, fontSize: 12, lineHeight: 19 }, textLink: { color: C.blue, fontWeight: '700', fontSize: 14, paddingVertical: 10 },
  button: { minHeight: 48, backgroundColor: C.blue, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, buttonSubtle: { backgroundColor: C.sky }, buttonLabel: { color: C.white, fontWeight: '700', fontSize: 14 }, buttonLabelSubtle: { color: C.blue }, pressed: { opacity: 0.75 }, tiles: { gap: 14 }, tile: { padding: 22, gap: 10, borderWidth: 1, borderColor: C.line, backgroundColor: C.white, borderRadius: 18 }, tileBlue: { backgroundColor: LIGHT.surfaceRaised }, tileNumber: { color: C.gold, fontSize: 10, letterSpacing: 2, fontWeight: '700' }, sectionHead: { gap: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  card: { backgroundColor: C.white, borderRadius: 18, borderWidth: 1, borderColor: C.line, overflow: 'hidden' }, cardContent: { padding: 20, gap: 8 }, photo: { width: '100%', height: 245, backgroundColor:LIGHT.background }, photoFallback: { height: 150, backgroundColor: LIGHT.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: 12 }, monogram: { color: LIGHT.accent, fontSize: 56, fontWeight: '300' }, photoLabel: { color: LIGHT.accent, fontSize: 9, letterSpacing: 3 }, shop: { backgroundColor: LIGHT.surfaceRaised, padding: 24, borderRadius: 20, gap: 16 }, state: { padding: 24, alignItems: 'center', gap: 16, backgroundColor: C.white, borderRadius: 16 }, searchRow: { flexDirection: 'row', gap: 10 }, input: { flex: 1, minWidth: 0, minHeight: 50, borderColor: C.line, borderWidth: 1, backgroundColor: C.white, borderRadius: 12, paddingHorizontal: 14, fontSize: 15, color: C.navy }, chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, chip: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 24, backgroundColor: C.white, borderColor: C.line, borderWidth: 1 }, chipActive: { backgroundColor: C.navy, borderColor: C.navy }, chipText: { color: C.muted, fontSize: 13 }, chipActiveText: { color: C.white },
  post: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 20, gap: 18 }, postHead: { flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.sky, justifyContent: 'center', alignItems: 'center' }, avatarText: { color: C.blue, fontWeight: '700', fontSize: 20 }, postBody: { fontSize: 16, lineHeight: 26, color: C.navy }, workspace: { backgroundColor: C.white, padding: 24, borderWidth: 1, borderColor: C.line, borderRadius: 18, gap: 16 }, note: { borderLeftWidth: 3, borderLeftColor: C.gold, paddingLeft: 16 }, error: { padding: 16, backgroundColor: '#FFF0DF', gap: 10 },
  nav: { flexDirection: 'row', backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.line, paddingHorizontal: 8, paddingTop: 8, paddingBottom: Platform.OS === 'android' ? 22 : 8 }, navItem: { flex: 1, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12 }, navSelected: { backgroundColor: C.sky }, navIcon: { fontSize: 24, color: C.muted }, navLabel: { fontSize: 11, fontWeight: '600', color: C.muted }, navActive: { color: C.blue },
});

export default function App() { return <AuthProvider><ZoiApp /></AuthProvider>; }
