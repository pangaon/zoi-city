import {useMemo,useState} from 'react';
import {ScaleText as Text} from './ScaleText';
import {Image,Linking,Modal,Pressable,ScrollView,Share,StyleSheet,useColorScheme,useWindowDimensions,View} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {ServiceOfferings} from './ServiceOfferings';
import type {NativeServiceOfferings} from './serviceOfferings';

type Appearance={background:string;ink:string;muted:string;accent:string;primaryColor:string;surface:string;line:string;copy?:Record<string,string>};
type ProfessionalProfile={
 id:string;name:string;slug?:string;location?:string;photo?:string;gallery:string[];description?:string;
 website?:string;phoneHref?:string|null;email?:string;inquiryListing?:string;
 serviceOfferings:NativeServiceOfferings;
 publishedDesign?:{copy?:Record<string,string>}|null;
};

/** Compact source-backed professional portfolio. Enquiries are listing-scoped and are never represented as bookings. */
export function ProfessionalHome({profile,appearance,back,enquiry}:{profile:ProfessionalProfile;appearance:Appearance;back:()=>void;enquiry:(listing:string)=>void}){
 const dark=useColorScheme()==='dark', {width,fontScale}=useWindowDimensions();
 const [heroFailed,setHeroFailed]=useState(false),[failed,setFailed]=useState<Record<string,boolean>>({}),[selected,setSelected]=useState<number|null>(null),[error,setError]=useState('');
 const copy=profile.publishedDesign?.copy||appearance.copy||{};
 const gallery=profile.gallery.filter(url=>!failed[url]);
 const styles=useMemo(()=>makeStyles(appearance,dark),[appearance,dark]);
 const hero=!!profile.photo&&!heroFailed;
 const heroHeight=Math.max(214,Math.min(310,width*.68))+Math.max(0,(fontScale-1)*96);
 const headline=copy.headline?.trim();
 const intro=copy.intro?.trim()||profile.description?.trim();
 const contacts:[string,string][]=[];
 if(profile.phoneHref)contacts.push(['Call',profile.phoneHref]);
 if(profile.email&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))contacts.push(['Email','mailto:'+encodeURIComponent(profile.email)]);
 if(profile.website)contacts.push(['Website',profile.website]);
 const open=async(url:string)=>{setError('');try{await Linking.openURL(url)}catch{setError('Could not open that link. Try another contact option.')}};
 const share=async()=>{setError('');try{await Share.share({title:profile.name,message:[profile.name,profile.location,'https://www.zoi.city/p/'+encodeURIComponent(profile.slug||'')].filter(Boolean).join(' · ')})}catch{setError('Sharing is unavailable.')}};
 const inquiry=()=>{if(profile.inquiryListing)enquiry(profile.inquiryListing);else if(contacts[0])void open(contacts[0][1]);};
 return <ScrollView keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={styles.content}>
  <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.iconButton}><Text style={styles.iconText}>‹</Text></Pressable><View style={styles.topFill}/><Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void share()} style={styles.iconButton}><Text style={styles.iconText}>↗</Text></Pressable></View>
  <View style={[styles.hero,{minHeight:heroHeight}]}>
   {hero?<Image source={{uri:profile.photo||''}} accessibilityLabel={profile.name+' portrait or profile image'} resizeMode="cover" onError={()=>setHeroFailed(true)} style={StyleSheet.absoluteFill}/>:<View style={StyleSheet.absoluteFill}/>}
   {hero?<LinearGradient pointerEvents="none" colors={['rgba(6,12,20,0.02)','rgba(6,12,20,0.12)','rgba(6,12,20,0.88)']} locations={[0,.48,1]} style={StyleSheet.absoluteFill}/>:null}
   <View style={[styles.identity,!hero&&styles.identityFallback]}>
    {profile.location?<Text numberOfLines={1} style={[styles.location,!hero&&styles.inkText]}>{profile.location}</Text>:null}
    <Text accessibilityRole="header" style={[styles.name,!hero&&styles.inkText]}>{profile.name}</Text>
    {headline&&headline.toLowerCase()!==profile.name.toLowerCase()?<Text numberOfLines={2} style={[styles.headline,!hero&&styles.mutedText]}>{headline}</Text>:null}
   </View>
  </View>
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {intro?<View style={styles.intro}><Text style={styles.introText}>{intro}</Text></View>:null}
  {profile.serviceOfferings.items.length||profile.serviceOfferings.bounded?<View style={styles.section}>
   <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.offerings_title?.trim()||'Services'}</Text>
   <ServiceOfferings offerings={profile.serviceOfferings} appearance={appearance}/>
  </View>:null}
  {gallery.length?<View style={styles.section}>
   <Text accessibilityRole="header" style={styles.sectionTitle}>{copy.gallery_title?.trim()||'Selected work'}</Text>
   <View style={styles.gallery}>{gallery.map((url,index)=><Pressable key={url} accessibilityRole="button" accessibilityLabel={'Open image '+(index+1)+' for '+profile.name} onPress={()=>setSelected(index)} style={[styles.imageFrame,{width:(width-44)/2,height:(width-44)/2}]}><Image source={{uri:url}} accessibilityLabel={'Image '+(index+1)+' for '+profile.name} resizeMode="cover" onError={()=>setFailed(previous=>({...previous,[url]:true}))} style={StyleSheet.absoluteFill}/></Pressable>)}</View>
  </View>:null}
  {profile.inquiryListing?<Pressable accessibilityRole="button" onPress={inquiry} style={styles.primary}><Text numberOfLines={1} style={styles.primaryText}>{copy.contact_title?.trim()||'Send an enquiry'}</Text><Text style={styles.arrow}>→</Text></Pressable>:contacts.length?<Pressable accessibilityRole="button" onPress={inquiry} style={styles.primary}><Text numberOfLines={1} style={styles.primaryText}>{contacts[0][0]}</Text><Text style={styles.arrow}>↗</Text></Pressable>:null}
  {contacts.length>1?<View style={styles.contacts}>{contacts.slice(profile.inquiryListing?0:1).map(([label,url])=><Pressable key={label} accessibilityRole="link" accessibilityLabel={label} onPress={()=>void open(url)} style={styles.contact}><Text style={styles.contactText}>{label}</Text></Pressable>)}</View>:null}
  {!profile.inquiryListing&&!contacts.length?<Text style={styles.mutedText}>Contact details are not available.</Text>:null}
  {profile.inquiryListing?<Text style={styles.note}>Enquiry only. No appointment or booking is confirmed here.</Text>:null}
  <Modal visible={selected!==null} transparent animationType="fade" onRequestClose={()=>setSelected(null)}>
   <View style={styles.modal}><Pressable accessibilityRole="button" accessibilityLabel="Close image" onPress={()=>setSelected(null)} style={styles.close}><Text style={styles.iconText}>×</Text></Pressable>{selected!==null&&gallery[selected]?<Image source={{uri:gallery[selected]}} accessibilityLabel={'Image '+(selected+1)+' for '+profile.name} resizeMode="contain" onError={()=>{setFailed(previous=>({...previous,[gallery[selected]]:true}));setSelected(null)}} style={{width:width-32,height:'76%'}}/>:null}<View style={styles.modalControls}><Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={selected===null||selected===0} onPress={()=>setSelected(value=>value===null?null:Math.max(0,value-1))} style={styles.iconButton}><Text style={styles.iconText}>‹</Text></Pressable><Text style={styles.note}>{selected===null?'':`${selected+1} / ${gallery.length}`}</Text><Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={selected===null||selected>=gallery.length-1} onPress={()=>setSelected(value=>value===null?null:Math.min(gallery.length-1,value+1))} style={styles.iconButton}><Text style={styles.iconText}>›</Text></Pressable></View></View>
  </Modal>
 </ScrollView>;
}

function makeStyles(a:Appearance,dark:boolean){
 const bg=dark?'#0D1722':a.background,surface=dark?'#142535':a.surface,ink=dark?'#F3F6FA':a.ink,muted=dark?'#B7C4D1':a.muted,line=dark?'#33495E':a.line,accent=dark?'#8AB8FF':a.accent,primary=dark&&a.primaryColor==='#FFFFFF'?'#245EAB':a.primaryColor;
 return StyleSheet.create({screen:{flex:1,backgroundColor:bg},content:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:16,paddingTop:4,paddingBottom:32,gap:14},top:{height:46,flexDirection:'row',alignItems:'center',gap:10},topFill:{flex:1},iconButton:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:dark?'#243749':'rgba(255,255,255,.86)',borderWidth:1,borderColor:line},iconText:{fontSize:23,lineHeight:28,color:ink},hero:{width:'100%',borderRadius:24,overflow:'hidden',justifyContent:'flex-end',backgroundColor:surface},identity:{paddingHorizontal:18,paddingVertical:17,gap:5},identityFallback:{minHeight:150,justifyContent:'flex-end'},location:{color:'rgba(255,255,255,.82)',fontSize:12,lineHeight:16},name:{color:'#FFFFFF',fontSize:27,lineHeight:33,fontWeight:'600',letterSpacing:-.5},headline:{color:'rgba(255,255,255,.92)',fontSize:15,lineHeight:21,fontWeight:'500'},inkText:{color:ink},mutedText:{color:muted,fontSize:14,lineHeight:21},intro:{paddingHorizontal:2},introText:{color:muted,fontSize:14,lineHeight:21},section:{gap:9},sectionTitle:{color:ink,fontSize:18,lineHeight:24,fontWeight:'600',letterSpacing:-.2},gallery:{flexDirection:'row',flexWrap:'wrap',gap:10},imageFrame:{borderRadius:16,overflow:'hidden',backgroundColor:surface,borderWidth:1,borderColor:line},primary:{minHeight:50,paddingHorizontal:17,borderRadius:16,backgroundColor:primary,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},primaryText:{color:'#FFFFFF',fontSize:15,lineHeight:20,fontWeight:'700',flexShrink:1},arrow:{color:'#FFFFFF',fontSize:21,lineHeight:26},contacts:{flexDirection:'row',flexWrap:'wrap',gap:8},contact:{minHeight:46,minWidth:48,paddingHorizontal:15,borderRadius:23,alignItems:'center',justifyContent:'center',backgroundColor:surface,borderWidth:1,borderColor:line},contactText:{fontSize:13,lineHeight:18,color:ink,fontWeight:'600'},note:{color:muted,fontSize:12,lineHeight:17},error:{color:dark?'#FF9EA7':'#B42332',fontSize:13,lineHeight:19},modal:{flex:1,backgroundColor:'rgba(5,9,14,.96)',justifyContent:'center',alignItems:'center',gap:18,padding:16},close:{position:'absolute',right:16,top:48,zIndex:1,width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center',backgroundColor:'#26313D'},modalControls:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:30}});
}
