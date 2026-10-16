import {useEffect,useMemo,useRef,useState} from 'react';
import {ScaleText as Text} from './ScaleText';
import {ActivityIndicator,Image,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,useColorScheme,useWindowDimensions,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {useAuth} from './Auth';
import {normalizeProfile,publicURL,profileMapLink} from './profile';
import {musicDraft} from './music';
import {BookingPanel} from './Bookings';
import {EventHomeTools} from './EventHome';
import {ArtistHome} from './ArtistHome';
import {uuid} from './artistMusic';
import {FoodMenu} from './FoodMenu';
import {ServiceOfferings} from './ServiceOfferings';
import {clientHomeDesign} from './clientHomePresentation';

type ClientProfile=NonNullable<ReturnType<typeof normalizeProfile>>;
type Section='offerings'|'booking'|'gallery'|'about'|'visit'|'contact';
export function BusinessProfile({slug,back,signIn,volunteer,enquiry,calendar,group,festival,shows}:{slug:string;back:()=>void;signIn:()=>void;volunteer:(workspace:string)=>void;enquiry:(listing:string)=>void;calendar:(listing:string)=>void;group:(listing:string)=>void;festival:(listing:string)=>void;shows:(artist:string)=>void}){
 const{client}=useAuth(),dark=useColorScheme()==='dark',{width,fontScale}=useWindowDimensions();
 const[profile,setProfile]=useState<ClientProfile|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0),[imageFailed,setImageFailed]=useState(false),[logoFailed,setLogoFailed]=useState(false);
 const[failedGallery,setFailedGallery]=useState<Record<string,boolean>>({});
 const[galleryIndex,setGalleryIndex]=useState<number|null>(null),[activeTab,setActiveTab]=useState('');
 const scroll=useRef<ScrollView>(null),sectionY=useRef<Partial<Record<Section,number>>>({});
 useEffect(()=>{let active=true;setLoading(true);setProfile(null);setError('');setImageFailed(false);setLogoFailed(false);setFailedGallery({});setGalleryIndex(null);setActiveTab('');sectionY.current={};client.request('/rest/v1/rpc/home_entity',{p_slug:slug}).then(data=>{if(active)setProfile(normalizeProfile(data));}).catch(()=>{if(active)setError('Could not load this profile.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;}},[slug,retry,client]);
 const visibleGallery=profile?profile.gallery.filter(url=>!failedGallery[url]):[];
 const design=useMemo(()=>profile?clientHomeDesign({...profile,gallery:visibleGallery},dark):null,[profile,dark,failedGallery]);
 const styles=useMemo(()=>profileStyles(dark,design?.background||'#F4F6F9',design?.ink||'#1D2C40',design?.muted||'#687483',design?.accent||'#1F64CD',design?.primaryColor||design?.accent||'#1F64CD',design?.surface||'#FFFFFF',design?.line||'#DCE3EB'),[dark,design]);
 const mapLink=profile?profileMapLink(profile):'';
 const music=profile&&['artist','musician'].includes(profile.type)?musicDraft(profile.profile):null;
 const move=(key:Section)=>{const y=sectionY.current[key];if(typeof y==='number'){setActiveTab(key);scroll.current?.scrollTo({y:Math.max(0,y-12),animated:true});}};
 const open=async(url:string)=>{try{await Linking.openURL(url);}catch{setError('That link could not be opened.');}};
 const action=(label:string,url:string,kind:'button'|'link'='link')=><Pressable key={label+url} accessibilityRole={kind} accessibilityLabel={label} onPress={()=>void open(url)} style={styles.utility}><Text style={styles.utilityText}>{label}</Text></Pressable>;
 if(profile?.type==='artist'&&uuid(profile.id)&&!loading&&!error)return <ArtistHome key={profile.id} profile={profile} back={back} signIn={signIn} shows={shows} enquiry={enquiry}/>;
 // Keep the photographic header editorial and compact. A profile without
 // verified photography gets a short identity panel instead of a large blank
 // hero; long names wrap inside the panel and system text scaling remains on.
 const hasHeroPhoto=!!profile?.photo&&!imageFailed;
 const scale=fontScale||1,titleLines=Math.min(8,Math.max(1,Math.ceil((profile?.name.length||1)/Math.max(7,(width-64)/(17*scale)))));
 const identityHeight=79+scale*(16+34*titleLines);
 const heroHeight=hasHeroPhoto?Math.max(228,width*.62,identityHeight):Math.max(132,identityHeight);
 const primary=()=>{
  if(!profile||!design)return;
  if(profile.bookingListing){move('booking');return;}
  if(profile.food){move('offerings');return;}
  if(profile.inquiryListing){enquiry(profile.inquiryListing);return;}
  if(profile.website){void open(profile.website);return;}
  if(profile.phoneHref){void open(profile.phoneHref);return;}
  if(mapLink)void open(mapLink);else if(profile.addressLookup)void open(profile.addressLookup.href);
 };
 const placeSection=(key:Section,event:any)=>{if(typeof event?.nativeEvent?.layout?.y==='number')sectionY.current[key]=event.nativeEvent.layout.y;};
 return <ScrollView ref={scroll} testID="client-home" keyboardShouldPersistTaps="handled" style={[styles.screen,{backgroundColor:design?.background||'#F4F6F9'}]} contentContainerStyle={styles.content}>
  {loading?<View style={styles.state}><ActivityIndicator color={design?.accent||'#1F64CD'}/></View>:null}
  {error?<View accessibilityRole="alert" style={styles.state}><Text style={styles.body}>{error}</Text><Pressable accessibilityRole="button" onPress={()=>setRetry(x=>x+1)} style={styles.retry}><Text style={styles.primaryText}>Retry</Text></Pressable></View>:null}
  {!loading&&!error&&!profile?<View style={styles.state}><Text style={styles.body}>This profile is unavailable.</Text><Pressable accessibilityRole="button" onPress={back} style={styles.utility}><Text style={styles.utilityText}>Back to Explore</Text></Pressable></View>:null}
  {profile&&design?<>
   <View style={[styles.hero,{height:heroHeight,backgroundColor:design.surface},!hasHeroPhoto&&styles.identityHero]} testID="profile-hero">
    {hasHeroPhoto?<Image source={{uri:profile?.photo||''}} resizeMode="cover" accessibilityLabel={profile?.name} style={StyleSheet.absoluteFill} onError={()=>setImageFailed(true)}/>:<View style={[StyleSheet.absoluteFill,{backgroundColor:design.surface}]}/>}
    {hasHeroPhoto?<LinearGradient pointerEvents="none" colors={['rgba(5,12,18,0.05)','rgba(5,12,18,0.16)','rgba(5,12,18,0.86)']} locations={[0,.38,1]} style={StyleSheet.absoluteFill}/>:null}
    <View style={styles.heroTop}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.glassButton}><Text allowFontScaling={false} style={styles.glassText}>‹</Text></Pressable>{profile.logo&&!logoFailed?<Image source={{uri:profile.logo}} resizeMode="contain" accessibilityLabel={profile.name+' logo'} style={styles.logo} onError={()=>setLogoFailed(true)}/>:null}<Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void Share.share({title:profile.name,message:profile.name+' · '+(profile.location||'')+'\nhttps://www.zoi.city/p/'+encodeURIComponent(profile.slug||slug)}).catch(()=>setError('Sharing is unavailable.'))} style={styles.glassButton}><Text allowFontScaling={false} style={styles.glassText}>↗</Text></Pressable></View>
    <View style={styles.heroCopy}>
     <View style={styles.metaLine}>{profile.location?<Text numberOfLines={1} style={[styles.heroMeta,!hasHeroPhoto&&styles.identityMeta]}>{profile.location}</Text>:null}{profile.verified?<Text style={[styles.verified,!hasHeroPhoto&&styles.identityMeta]}>Verified</Text>:null}</View>
     <Text accessibilityRole="header" accessibilityLabel={profile.name} style={[styles.title,!hasHeroPhoto&&styles.identityTitle]}>{profile.name}</Text>
    </View>
   </View>
   {design.primary?<Pressable accessibilityRole="button" onPress={primary} style={({pressed})=>[styles.primary,pressed&&{opacity:.84}]}><Text numberOfLines={1} style={styles.primaryText}>{design.primary}</Text><Text style={styles.primaryArrow}>→</Text></Pressable>:null}
   <View style={styles.utilityRow}>
    {(mapLink||profile.addressLookup)&&design.primary!=='Get directions'?action('Directions',mapLink||profile.addressLookup!.href,'button'):null}
    {profile.phoneHref&&design.primary!=='Call'?action('Call',profile.phoneHref,'button'):null}
    {profile.website&&design.primary!=='Visit website'?action('Website',profile.website,'button'):null}
    {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)?action('Email','mailto:'+encodeURIComponent(profile.email),'button'):null}
   </View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist" accessibilityLabel="Profile sections">
    {design.tabs.map(tab=><Pressable key={tab.key} accessibilityRole="tab" accessibilityState={{selected:(activeTab||design.tabs[0]?.key)===tab.key}} accessibilityLabel={tab.label} onPress={()=>move(tab.key as Section)} style={[styles.tab,(activeTab||design.tabs[0]?.key)===tab.key?styles.tabSelected:null]}><Text style={styles.tabText}>{tab.label}</Text></Pressable>)}
   </ScrollView>
   {profile.food?<View onLayout={event=>placeSection('offerings',event)}><FoodMenu key={'food:'+profile.id} food={profile.food} appearance={design}/></View>:null}
   {!profile.food&&profile.serviceOfferings.items.length?<View onLayout={event=>placeSection('offerings',event)}><ServiceOfferings key={'services:'+profile.id} offerings={profile.serviceOfferings} appearance={design}/></View>:null}
   {profile.bookingListing?<View onLayout={event=>placeSection('booking',event)}><BookingPanel listingId={profile.bookingListing} signIn={signIn}/></View>:null}
   {visibleGallery.length?<View onLayout={event=>placeSection('gallery',event)} style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>{design.family==='arts'?'Selected work':'Photos'}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>{visibleGallery.map((url,index)=><Pressable key={url} accessibilityRole="button" accessibilityLabel={'Open photo '+(index+1)} onPress={()=>setGalleryIndex(index)}><Image source={{uri:url}} resizeMode="cover" style={styles.galleryImage} onError={()=>setFailedGallery(previous=>({...previous,[url]:true}))}/></Pressable>)}</ScrollView></View>:null}
   {profile.description?<View onLayout={event=>placeSection('about',event)} style={styles.section}><Text style={styles.body}>{profile.description}</Text></View>:null}
   {profile.address||profile.location?<View onLayout={event=>placeSection('visit',event)} style={styles.visit}>{profile.address?<Text selectable style={styles.body}>{profile.address}</Text>:null}{!profile.address&&profile.location?<Text style={styles.body}>{profile.location}</Text>:null}</View>:null}
   {profile.socials.length?<View onLayout={event=>placeSection('contact',event)} style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>Connect</Text><View style={styles.utilityRow}>{profile.socials.map(social=>action(social.label,social.url,'button'))}</View></View>:null}
   {music?<View style={styles.section}><Text accessibilityRole="header" style={styles.sectionTitle}>Music</Text>{music.press?<Text style={styles.body}>{music.press}</Text>:null}<View style={styles.utilityRow}>{[['spotify','Listen'],['youtube','Watch'],['instagram_url','Instagram'],['facebook_url','Facebook'],['merch','Merch']].map(([key,label])=>publicURL(music[key])?action(label,publicURL(music[key]),'button'):null)}</View></View>:null}
   {profile.showsArtist?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>shows(profile.showsArtist)}><Text style={styles.featureTitle}>Shows</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {profile.festivalListing?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>festival(profile.festivalListing)}><Text style={styles.featureTitle}>Festival</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {profile.groupListing?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>group(profile.groupListing)}><Text style={styles.featureTitle}>Community</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {profile.calendarListing?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>calendar(profile.calendarListing)}><Text style={styles.featureTitle}>Calendar</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {profile.volunteerWorkspace?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>volunteer(profile.volunteerWorkspace)}><Text style={styles.featureTitle}>Volunteer</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {profile.inquiryListing&&!profile.bookingListing?<Pressable accessibilityRole="button" style={styles.feature} onPress={()=>enquiry(profile.inquiryListing)}><Text style={styles.featureTitle}>{design.family==='grooming'?'Request an appointment':'Contact'}</Text><Text style={styles.featureArrow}>→</Text></Pressable>:null}
   {['venue','event'].includes(profile.type)?<EventHomeTools key={'events:'+profile.id} listing={profile.id}/>:null}
   <Modal visible={galleryIndex!==null} transparent animationType="fade" onRequestClose={()=>setGalleryIndex(null)}><View style={styles.galleryModal}><Pressable accessibilityRole="button" accessibilityLabel="Close photos" onPress={()=>setGalleryIndex(null)} style={styles.galleryClose}><Text allowFontScaling={false} style={styles.glassText}>×</Text></Pressable>{galleryIndex!==null&&visibleGallery[galleryIndex]?<Image source={{uri:visibleGallery[galleryIndex]}} resizeMode="contain" accessibilityLabel={profile.name+' photo '+(galleryIndex+1)} style={{width:width-32,height:'72%'}} onError={()=>{setFailedGallery(previous=>({...previous,[visibleGallery[galleryIndex]]:true}));setGalleryIndex(null);}}/>:null}<View style={styles.galleryControls}><Pressable accessibilityRole="button" accessibilityLabel="Previous photo" disabled={galleryIndex===null||galleryIndex<=0} onPress={()=>setGalleryIndex(n=>n===null?null:Math.max(0,n-1))} style={styles.glassButton}><Text allowFontScaling={false} style={styles.glassText}>‹</Text></Pressable><Text style={styles.galleryCount}>{galleryIndex===null?'':`${galleryIndex+1} / ${visibleGallery.length}`}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next photo" disabled={galleryIndex===null||galleryIndex>=visibleGallery.length-1} onPress={()=>setGalleryIndex(n=>n===null?null:Math.min(visibleGallery.length-1,n+1))} style={styles.glassButton}><Text allowFontScaling={false} style={styles.glassText}>›</Text></Pressable></View></View></Modal>
  </>:null}
 </ScrollView>;
}
function profileStyles(dark:boolean,background:string,ink:string,muted:string,accent:string,primaryColor:string,surface:string,line:string){
 return StyleSheet.create({
  screen:{flex:1},content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:16,paddingTop:8,paddingBottom:32,gap:12},state:{minHeight:180,alignItems:'center',justifyContent:'center',gap:14},
  hero:{width:'100%',borderRadius:26,overflow:'hidden',justifyContent:'space-between'},identityHero:{borderWidth:1,borderColor:line},heroTop:{paddingHorizontal:14,paddingTop:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10},glassButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(10,22,32,0.62)',borderWidth:1,borderColor:'rgba(255,255,255,.64)'},glassText:{fontSize:25,lineHeight:30,color:'#FFFFFF'},logo:{width:52,height:40,backgroundColor:'rgba(255,255,255,.90)',borderRadius:12,padding:4},heroCopy:{paddingHorizontal:18,paddingBottom:17,gap:6},metaLine:{flexDirection:'row',alignItems:'center',gap:8},heroMeta:{color:'rgba(255,255,255,.88)',fontSize:12,lineHeight:16,flexShrink:1},identityMeta:{color:muted},verified:{fontSize:11,lineHeight:16,color:'#FFFFFF',fontWeight:'600'},title:{fontSize:28,lineHeight:34,fontWeight:'600',letterSpacing:-.4,color:'#FFFFFF',flexShrink:1},identityTitle:{color:ink},
  primary:{minHeight:52,paddingHorizontal:18,paddingVertical:12,borderRadius:16,backgroundColor:primaryColor,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},primaryText:{fontSize:15,lineHeight:20,color:'#FFFFFF',fontWeight:'700',flexShrink:1},primaryArrow:{fontSize:21,lineHeight:24,color:'#FFFFFF'},utilityRow:{flexDirection:'row',flexWrap:'wrap',gap:8},utility:{minHeight:48,minWidth:48,borderRadius:24,paddingHorizontal:14,justifyContent:'center',alignItems:'center',backgroundColor:dark?'#1B2B38':surface,borderWidth:1,borderColor:line,flexGrow:0,flexShrink:1},utilityText:{fontSize:13,lineHeight:18,color:ink,fontWeight:'600'},tabs:{gap:20,borderBottomWidth:1,borderBottomColor:line,paddingTop:4},tab:{minHeight:48,justifyContent:'center',paddingHorizontal:4,borderBottomWidth:2,borderBottomColor:'transparent'},tabSelected:{borderBottomColor:accent},tabText:{fontSize:13,lineHeight:18,color:ink,fontWeight:'600'},
  section:{gap:10,paddingTop:4},sectionTitle:{fontSize:20,lineHeight:25,color:ink,fontWeight:'600',letterSpacing:-.2},body:{fontSize:15,lineHeight:22,color:muted},muted:{fontSize:12,lineHeight:17,color:muted},visit:{gap:8,padding:14,borderRadius:18,backgroundColor:surface,borderWidth:1,borderColor:line},gallery:{gap:10,paddingVertical:2},galleryImage:{width:168,height:128,borderRadius:14,backgroundColor:line},galleryModal:{flex:1,backgroundColor:'rgba(5,9,14,.96)',justifyContent:'center',alignItems:'center',gap:18,padding:16},galleryClose:{position:'absolute',right:16,top:48,zIndex:1,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#26313D'},galleryControls:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:30},galleryCount:{fontSize:14,color:'#FFFFFF'},feature:{minHeight:60,paddingHorizontal:15,paddingVertical:10,borderRadius:16,backgroundColor:surface,borderWidth:1,borderColor:line,flexDirection:'row',alignItems:'center',gap:12},featureTitle:{fontSize:16,lineHeight:21,color:ink,fontWeight:'600',flex:1},featureArrow:{fontSize:20,color:accent},retry:{minHeight:48,minWidth:96,alignItems:'center',justifyContent:'center',backgroundColor:primaryColor,borderRadius:14,paddingHorizontal:18},
 });
}
