import { useEffect, useMemo, useState } from 'react';
import {ScaleText as Text} from './ScaleText';
import { ActivityIndicator, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { useAuth } from './Auth';
import { normalizeProfile, publicURL, plain, profileMapLink } from './profile';
import { musicDraft, musicFields } from './music';
import { BookingPanel } from './Bookings';
import { EventHomeTools } from './EventHome';
import {ArtistHome} from './ArtistHome';
import {uuid} from './artistMusic';
import {FoodMenu} from './FoodMenu';
import {ServiceOfferings} from './ServiceOfferings';
export function BusinessProfile({ slug, back, signIn, volunteer, enquiry, calendar, group, festival, shows }: { slug: string; back: () => void; signIn: () => void; volunteer: (workspace: string) => void; enquiry: (listing: string) => void; calendar: (listing: string) => void; group: (listing: string) => void; festival: (listing: string) => void; shows: (artist:string)=>void }) {
  const { client } = useAuth(); const dark=useColorScheme()==='dark',s=useMemo(()=>profileStyles(dark),[dark]); const [profile, setProfile] = useState<ReturnType<typeof normalizeProfile>>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [retry, setRetry] = useState(0); const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { let active = true; setLoading(true); setProfile(null); setError(''); setImageFailed(false); client.request('/rest/v1/rpc/home_entity', { p_slug: slug }).then(data => { if (active) setProfile(normalizeProfile(data)); }).catch(() => { if (active) setError('This profile could not be loaded. Please try again.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [slug, retry, client]);
  const open = async (url: string) => { try { await Linking.openURL(url); } catch { setError('Your device could not open this link. Please try another contact option.'); } };
  const mapLink=profile?profileMapLink(profile):'';
  const serviceHome=!!profile&&!profile.food&&profile.serviceOfferings.items.length>0;
  const music = profile && ['artist','musician'].includes(profile.type) ? musicDraft(profile.profile) : null;
  const action = (label: string, url: string) => <Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={() => open(url)} style={s.action}><Text style={s.link}>{label} ↗</Text></Pressable>;
  if(profile?.type==='artist'&&uuid(profile.id)&&!loading&&!error)return <ArtistHome key={profile.id} profile={profile} back={back} signIn={signIn} shows={shows} enquiry={enquiry}/>;
  return <ScrollView testID="client-home" keyboardShouldPersistTaps="handled" style={s.screen} contentContainerStyle={s.content}><Pressable accessibilityRole="button" onPress={back} style={s.action}><Text style={s.link}>← Back</Text></Pressable>{loading ? <ActivityIndicator color="#116CBA" /> : null}{error ? <View accessibilityRole="alert" style={s.panel}><Text style={s.body}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(v => v + 1)} style={s.action}><Text style={s.link}>Try again</Text></Pressable></View> : null}{!loading && !error && !profile ? <Text style={s.body}>This listing is not available. It may have been moved or unpublished.</Text> : null}{profile ? <>
    <View testID={profile.food?'food-home-identity':serviceHome?'service-home-identity':'client-home-identity'} style={[s.identity,profile.food?s.foodIdentity:serviceHome?s.serviceIdentity:null]}>
      <Text style={s.eyebrow}>{profile.food?(profile.food.family==='bakery'?'Bakery':'Restaurant'):serviceHome?'Services':profile.type||'The Greek world'}</Text>
      <Text accessibilityRole="header" style={[s.title,profile.food?s.foodTitle:null]}>{profile.name}</Text>
      {profile.verified?<Text style={s.verified}>Verified listing</Text>:null}
      {profile.location?<Text style={s.body}>{profile.location}</Text>:null}
      {serviceHome&&profile.inquiryListing?<Pressable accessibilityRole="button" onPress={()=>enquiry(profile.inquiryListing)} style={s.primary}><Text style={s.primaryText}>Ask about services →</Text></Pressable>:null}
    </View>
    <View style={s.row}>{profile.website ? action('Website', profile.website) : null}{profile.phoneHref ? action('Call ' + profile.phone, profile.phoneHref) : profile.phone ? <Text selectable style={s.body}>{profile.phone}</Text> : null}{/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ? action('Email', 'mailto:' + encodeURIComponent(profile.email)) : null}{mapLink ? action('Map & directions', mapLink) : profile.addressLookup ? action('Find published address', profile.addressLookup.href) : null}</View>
    {profile.photo&&!imageFailed?<View style={[s.media,serviceHome?s.serviceMedia:null]}><Image source={{uri:profile.photo}} resizeMode="contain" accessibilityLabel={profile.name} style={[s.photo,serviceHome?s.servicePhoto:null]} onError={()=>setImageFailed(true)}/></View>:null}
    {profile.food?<FoodMenu key={'food:'+profile.id} food={profile.food}/>:null}
    {serviceHome?<ServiceOfferings key={'services:'+profile.id} offerings={profile.serviceOfferings}/>:null}
    {serviceHome&&profile.bookingListing?<BookingPanel listingId={profile.bookingListing} signIn={signIn}/>:null}
    <EventHomeTools key={'events:'+profile.id} listing={profile.id} />
    {profile.description ? <View style={s.panel}><Text style={s.heading}>About</Text><Text style={s.body}>{profile.description}</Text></View> : null}
    {profile.address ? <View style={s.panel}><Text style={s.heading}>Visit</Text><Text selectable style={s.body}>{profile.address}</Text></View> : null}
    {!serviceHome?<ServiceOfferings key={'services:'+profile.id} offerings={profile.serviceOfferings}/>:null}
    {profile.socials.length ? <View style={s.panel}><Text style={s.heading}>Follow their story</Text><View style={s.row}>{profile.socials.map(social => action(social.label, social.url))}</View></View> : null}
    {music ? <View style={s.panel}><Text style={s.heading}>Music & bookings</Text>{music.press ? <Text style={s.body}>{plain(music.press)}</Text> : null}<View style={s.row}>{musicFields.filter(([key]) => key.endsWith('_url') || key === 'merch').map(([key,label]) => publicURL(music[key]) ? action(label,publicURL(music[key])) : null)}</View>{/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(music.booking_email) ? action('Booking contact' + (music.booking_name ? ': ' + plain(music.booking_name) : ''),'mailto:' + encodeURIComponent(music.booking_email)) : null}{[['embeds','Featured music'],['releases','Releases'],['tour','Shows & tour dates']].map(([key,label]) => music[key].length ? <View key={key}><Text style={s.heading}>{label}</Text>{music[key].map((row:any,index:number) => publicURL(row.url) ? <View key={index}>{action(plain(row.title) || label,publicURL(row.url))}{row.date ? <Text style={s.small}>{plain(row.date)}</Text> : null}</View> : null)}</View> : null)}</View> : null}
    {profile.showsArtist ? <Pressable accessibilityRole="button" style={s.action} onPress={()=>shows(profile.showsArtist)}><Text style={s.link}>Confirmed shows & private trip planning →</Text></Pressable> : null}
    {profile.festivalListing ? <Pressable accessibilityRole="button" style={s.action} onPress={()=>festival(profile.festivalListing)}><Text style={s.link}>Sponsor and booth offers →</Text></Pressable> : null}
    {profile.groupListing ? <Pressable accessibilityRole="button" style={s.action} onPress={()=>group(profile.groupListing)}><Text style={s.link}>Adult group membership →</Text></Pressable> : null}
    {profile.calendarListing ? <Pressable accessibilityRole="button" style={s.action} onPress={()=>calendar(profile.calendarListing)}><Text style={s.link}>View community calendar →</Text></Pressable> : null}
    {!serviceHome&&profile.inquiryListing ? <Pressable accessibilityRole="button" style={s.action} onPress={() => enquiry(profile.inquiryListing)}><Text style={s.link}>Send a private enquiry →</Text></Pressable> : null}
    {!serviceHome&&profile.bookingListing ? <BookingPanel listingId={profile.bookingListing} signIn={signIn} /> : null}
    {profile.volunteerWorkspace ? <View style={s.panel}><Text style={s.heading}>Give your time</Text><Text style={s.body}>Explore this organization’s published volunteer opportunities.</Text><Pressable accessibilityRole="button" style={s.action} onPress={() => volunteer(profile.volunteerWorkspace)}><Text style={s.link}>Volunteer with this community →</Text></Pressable></View> : null}
    {profile.enrichmentNote ? <Text style={s.small}>{profile.enrichmentNote}</Text> : null}{action('Open canonical Zoi profile', 'https://www.zoi.city/p/' + encodeURIComponent(profile.slug || slug))}
  </> : null}</ScrollView>;
}
function profileStyles(dark:boolean){
 const ink=dark?'#F4F7FC':'#14243A',muted=dark?'#B3C1D3':'#516177',border=dark?'#36506E':'#DCE3EE',surface=dark?'#122339':'#FFFFFF',link=dark?'#87B2FF':'#075BFA';
 return StyleSheet.create({screen:{backgroundColor:dark?'#081525':'#F6F7FB'},content:{width:'100%',maxWidth:900,alignSelf:'center',padding:20,gap:18,paddingBottom:40},identity:{gap:10,minWidth:0},foodIdentity:{borderLeftWidth:3,borderLeftColor:dark?'#FFD080':'#855100',paddingLeft:16,paddingVertical:6},serviceIdentity:{backgroundColor:surface,borderWidth:1,borderColor:border,borderRadius:20,padding:20,gap:12},panel:{backgroundColor:surface,borderRadius:20,padding:20,gap:12,borderWidth:1,borderColor:border},title:{fontSize:30,lineHeight:38,fontWeight:'700',color:ink,flexShrink:1},foodTitle:{fontFamily:Platform.OS==='ios'?'Georgia':'serif',fontWeight:'500',fontSize:34,lineHeight:42},heading:{fontSize:22,lineHeight:30,color:ink,fontWeight:'700'},eyebrow:{fontSize:14,lineHeight:20,fontWeight:'600',color:muted},body:{color:muted,fontSize:16,lineHeight:25},small:{color:muted,fontSize:14,lineHeight:22},verified:{color:dark?'#7AD7B0':'#176B4B',fontSize:14,lineHeight:22,fontWeight:'600'},row:{flexDirection:'row',flexWrap:'wrap',gap:10},action:{paddingHorizontal:15,paddingVertical:13,minHeight:48,minWidth:48,backgroundColor:dark?'#192D46':'#EAF1FF',borderRadius:12,justifyContent:'center',maxWidth:'100%',flexShrink:1},link:{color:link,fontSize:16,lineHeight:24,fontWeight:'600',flexShrink:1},primary:{minHeight:48,minWidth:48,padding:14,borderRadius:12,backgroundColor:'#075BFA',justifyContent:'center',alignSelf:'flex-start',maxWidth:'100%'},primaryText:{fontSize:16,lineHeight:24,fontWeight:'700',color:'#FFFFFF',flexShrink:1},media:{backgroundColor:surface,borderRadius:24,borderWidth:1,borderColor:border,padding:12,overflow:'hidden'},photo:{width:'100%',height:220},serviceMedia:{alignSelf:'flex-start',width:'100%',maxWidth:320},servicePhoto:{height:180}});
}
