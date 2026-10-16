import {useMemo,useState} from 'react';
import {Image,Linking,Pressable,ScrollView,Share,StyleSheet,View,useWindowDimensions,type ImageStyle} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {ScaleText as Text} from './ScaleText';
import {BookingPanel} from './Bookings';
import {ServiceOfferings} from './ServiceOfferings';

type Profile={id:string;name:string;slug:string;location:string;description:string;photo:string;logo:string;gallery:string[];phoneHref:string|null;website:string;bookingListing:string;inquiryListing:string;verified:boolean;serviceOfferings:{items:unknown[];[key:string]:any};publishedDesign?:{copy?:Record<string,string>}|null};
type Design={background:string;ink:string;muted:string;accent:string;primaryColor:string;surface:string;line:string};
type Props={profile:Profile;design:Design;back:()=>void;signIn:()=>void;enquiry:(listing:string)=>void};
type Tab='services'|'photos'|'about'|'booking';

/** Source-led grooming profile: a portrait, published services and real appointment availability. */
export function GroomingHome({profile,design,back,signIn,enquiry}:Props){
 const[failedPhoto,setFailedPhoto]=useState(false),[failedLogo,setFailedLogo]=useState(false),[failedGallery,setFailedGallery]=useState<Record<string,boolean>>({}),[tab,setTab]=useState<Tab>('services');
 const{width,fontScale}=useWindowDimensions(),scale=fontScale||1;
 const hero=!!profile.photo&&!failedPhoto,photos=useMemo(()=>profile.gallery.filter(url=>!failedGallery[url]),[profile.gallery,failedGallery]);
 const copy=profile.publishedDesign?.copy||{};
 const open=(href:string)=>{void Linking.openURL(href).catch(()=>{});};
 const primary=profile.bookingListing?'Choose a time':profile.inquiryListing?'Request an appointment':profile.phoneHref?'Call the shop':profile.website?'View website':'';
 const runPrimary=()=>{if(profile.bookingListing)setTab('booking');else if(profile.inquiryListing)enquiry(profile.inquiryListing);else if(profile.phoneHref)open(profile.phoneHref);else if(profile.website)open(profile.website);};
 const tabs:Tab[]=['services',...(photos.length?['photos' as const]:[]),...(profile.bookingListing?['booking' as const]:[]),...((profile.description||copy.intro)?['about' as const]:[])];
 const labels:Record<Tab,string>={services:copy.offerings_title?.trim()||'Services',photos:copy.gallery_title?.trim()||'Work',about:'About',booking:copy.calendar_title?.trim()||'Appointments'};
 const titleLines=Math.min(8,Math.max(1,Math.ceil(profile.name.length/Math.max(8,(width-52)/(17*scale))))),headlineLines=copy.headline?.trim()&&copy.headline.trim().toLowerCase()!==profile.name.toLowerCase()?Math.min(2,Math.ceil(copy.headline.trim().length/Math.max(12,(width-52)/(8*scale)))):0;
 const identityHeight=82+scale*(17+36*titleLines+21*headlineLines);
 const heroHeight=hero?Math.max(264,Math.min(width*.78,340),identityHeight):Math.max(180,identityHeight+12);
 return <ScrollView testID="grooming-home" style={[s.screen,{backgroundColor:design.background}]} contentContainerStyle={s.content}>
  <View testID="profile-hero" style={[s.hero,{height:heroHeight,backgroundColor:design.surface},!hero&&s.heroEmpty,{borderColor:design.line}]}>
   {hero?<Image source={{uri:profile.photo}} resizeMode="cover" accessibilityLabel={profile.name} style={StyleSheet.absoluteFill} onError={()=>setFailedPhoto(true)}/>:null}
   {hero?<LinearGradient pointerEvents="none" colors={['rgba(7,12,17,0)','rgba(7,12,17,.24)','rgba(7,12,17,.88)']} locations={[0,.44,1]} style={StyleSheet.absoluteFill}/>:null}
   <View style={s.top}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={s.circle}><Text allowFontScaling={false} style={s.icon}>‹</Text></Pressable>
    {profile.logo&&!failedLogo?<Image source={{uri:profile.logo}} resizeMode="contain" accessibilityLabel={profile.name+' logo'} style={s.logo as ImageStyle} onError={()=>setFailedLogo(true)}/>:<View style={s.topSpacer}/>}
    <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void Share.share({title:profile.name,message:profile.name+'\nhttps://www.zoi.city/p/'+encodeURIComponent(profile.slug)}).catch(()=>{})} style={s.circle}><Text allowFontScaling={false} style={s.icon}>↗</Text></Pressable>
   </View>
   <View style={s.identity}>
    {profile.location?<Text numberOfLines={1} style={s.location}>{profile.location}</Text>:null}
    <Text accessibilityRole="header" style={s.name}>{profile.name}</Text>
    {copy.headline?.trim()&&copy.headline.trim().toLowerCase()!==profile.name.toLowerCase()?<Text style={s.headline}>{copy.headline.trim()}</Text>:null}
   </View>
  </View>
  {primary?<Pressable accessibilityRole="button" onPress={runPrimary} style={({pressed})=>[s.primary,{backgroundColor:design.primaryColor},pressed&&{opacity:.86}]}><Text numberOfLines={1} style={s.primaryLabel}>{primary}</Text><Text allowFontScaling={false} style={s.arrow}>→</Text></Pressable>:null}
  <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" contentContainerStyle={s.tabs}>
   {tabs.map(value=><Pressable key={value} accessibilityRole="tab" accessibilityState={{selected:tab===value}} onPress={()=>setTab(value)} style={[s.tab,{borderBottomColor:tab===value?design.accent:'transparent'}]}><Text style={[s.tabText,{color:tab===value?design.ink:design.muted}]}>{labels[value]}</Text></Pressable>)}
  </ScrollView>
  {tab==='services'?<View style={s.section}>
   {profile.serviceOfferings.items.length?<ServiceOfferings offerings={profile.serviceOfferings as any} appearance={design}/>:<Text style={[s.note,{color:design.muted}]}>No services listed.</Text>}
  </View>:null}
  {tab==='photos'?<View style={s.photoGrid}>{photos.map((uri,index)=><Image key={uri} source={{uri}} resizeMode="cover" accessibilityLabel={profile.name+' photo '+(index+1)} style={s.photo as ImageStyle} onError={()=>setFailedGallery(previous=>({...previous,[uri]:true}))}/>)}</View>:null}
  {tab==='booking'&&profile.bookingListing?<BookingPanel listingId={profile.bookingListing} signIn={signIn}/>:null}
  {tab==='about'?<View style={[s.about,{backgroundColor:design.surface,borderColor:design.line}]}><Text style={[s.aboutText,{color:design.ink}]}>{copy.intro?.trim()||profile.description}</Text>{profile.verified?<Text style={[s.verified,{color:design.accent}]}>Verified business</Text>:null}</View>:null}
 </ScrollView>;
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:'#101416'},content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:14,paddingTop:6,paddingBottom:26,gap:12},hero:{borderRadius:22,overflow:'hidden',justifyContent:'space-between',backgroundColor:'#20262A'},heroEmpty:{borderWidth:1,borderColor:'#3A4145'},top:{padding:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},topSpacer:{width:44,height:40},circle:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(9,16,21,.58)',borderWidth:1,borderColor:'rgba(255,255,255,.52)'},icon:{fontSize:25,lineHeight:30,color:'#FFFFFF'},logo:{width:62,height:42,backgroundColor:'rgba(255,255,255,.94)',borderRadius:10,padding:4},identity:{paddingHorizontal:18,paddingBottom:18,gap:4},location:{color:'#F3F0EA',fontSize:12,lineHeight:17},name:{fontFamily:'Georgia',fontSize:27,lineHeight:32,fontWeight:'400',letterSpacing:-.4,color:'#FFFFFF'},headline:{maxWidth:520,fontSize:14,lineHeight:20,color:'#E3E0DA'},primary:{minHeight:50,borderRadius:14,paddingHorizontal:16,backgroundColor:'#94603A',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},primaryLabel:{fontSize:15,lineHeight:20,fontWeight:'700',color:'#FFFFFF'},arrow:{fontSize:22,lineHeight:26,color:'#FFFFFF'},tabs:{gap:20,borderBottomWidth:1,borderBottomColor:'#343B40'},tab:{minHeight:46,justifyContent:'center',paddingHorizontal:4,borderBottomWidth:2,borderBottomColor:'transparent'},selected:{borderBottomColor:'#D69E6B'},tabText:{fontSize:13,lineHeight:18,color:'#BBBDBD',fontWeight:'600'},selectedText:{color:'#F5F2ED'},section:{gap:10},note:{fontSize:14,lineHeight:20,color:'#C0C0BC'},secondary:{minHeight:46,paddingHorizontal:14,borderRadius:12,borderWidth:1,borderColor:'#D69E6B',flexDirection:'row',alignItems:'center',justifyContent:'space-between'},secondaryText:{fontSize:14,lineHeight:18,color:'#F4D7B8',fontWeight:'600'},photoGrid:{flexDirection:'row',flexWrap:'wrap',gap:8},photo:{width:'48%',height:190,borderRadius:14,backgroundColor:'#20262A'},about:{gap:12,padding:16,borderRadius:16,backgroundColor:'#171C20',borderWidth:1,borderColor:'#3A4145'},aboutText:{fontSize:15,lineHeight:22,color:'#E2E0DB'},verified:{fontSize:12,lineHeight:17,color:'#D6A779'}});
