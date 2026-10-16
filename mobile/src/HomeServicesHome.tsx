import {useMemo,useState} from 'react';
import {ScaleText as Text} from './ScaleText';
import {LinearGradient} from 'expo-linear-gradient';
import {Image,Linking,Platform,Pressable,ScrollView,Share,StyleSheet,useColorScheme,useWindowDimensions,View} from 'react-native';
import type {NativeServiceOfferings} from './serviceOfferings';
import {ServiceOfferings} from './ServiceOfferings';
import {estimatePhotoHeroHeight} from './profileHeroLayout';

type Appearance={background:string;ink:string;muted:string;accent:string;primaryColor:string;surface:string;line:string;copy?:Record<string,string>};
type Profile={id:string;name:string;slug?:string;location?:string;photo?:string;logo?:string;gallery:string[];description?:string;website?:string;phoneHref?:string|null;email?:string;inquiryListing?:string;serviceOfferings:NativeServiceOfferings;publishedDesign?:{copy?:Record<string,string>}|null};

/** Local service journey: clear scope, request a quote, and only verified ways to contact. */
export function HomeServicesHome({profile,appearance,back,enquiry}:{profile:Profile;appearance:Appearance;back:()=>void;enquiry:(listing:string)=>void}){
 const dark=useColorScheme()==='dark', {width,fontScale}=useWindowDimensions(), [heroFailed,setHeroFailed]=useState(false),[logoFailed,setLogoFailed]=useState(false),[error,setError]=useState('');
 const copy=profile.publishedDesign?.copy||appearance.copy||{}, hero=!!profile.photo&&!heroFailed;
 const basePhotoHeroHeight=Math.max(210,Math.min(300,width*.62)),photoHeroHeight=estimatePhotoHeroHeight({width,baseHeight:basePhotoHeroHeight,fontScale,title:profile.name,titleFontSize:25,titleLineHeight:30,supportingText:[...(profile.location?[{text:profile.location,fontSize:12,lineHeight:16,maxLines:2}]:[]),...(copy.headline?.trim()&&copy.headline.trim().toLowerCase()!==profile.name.toLowerCase()?[{text:copy.headline.trim(),fontSize:13,lineHeight:18,maxLines:2}]:[])]});
 const styles=useMemo(()=>makeStyles(appearance,dark),[appearance,dark]);
 const open=async(url:string)=>{setError('');try{await Linking.openURL(url)}catch{setError('Could not open that link. Try another contact option.')}};
 const contact=()=>{if(profile.inquiryListing)enquiry(profile.inquiryListing);else if(profile.phoneHref)void open(profile.phoneHref);else if(profile.email)void open('mailto:'+encodeURIComponent(profile.email));else if(profile.website)void open(profile.website)};
 const share=async()=>{try{await Share.share({title:profile.name,message:[profile.name,profile.location,'https://www.zoi.city/p/'+encodeURIComponent(profile.slug||'')].filter(Boolean).join(' · ')})}catch{setError('Sharing is unavailable.')}};
 return <ScrollView testID="home-services-home" keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={styles.content}>
  <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.icon}><Text style={styles.iconText}>‹</Text></Pressable>{profile.logo&&!logoFailed?<Image source={{uri:profile.logo}} resizeMode="contain" accessibilityLabel={profile.name+' logo'} onError={()=>setLogoFailed(true)} style={styles.clientLogo}/>:null}<View style={styles.spacer}/><Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void share()} style={styles.icon}><Text style={styles.iconText}>↗</Text></Pressable></View>
  <View testID="profile-hero" style={[styles.hero,{height:hero?photoHeroHeight:undefined,minHeight:hero?210:0}]}>
   {hero?<><Image source={{uri:profile.photo}} accessibilityLabel={profile.name+' business'} resizeMode="cover" onError={()=>setHeroFailed(true)} style={StyleSheet.absoluteFill}/><LinearGradient pointerEvents="none" colors={photoHeroHeight>basePhotoHeroHeight?['rgba(5,13,20,.62)','rgba(5,13,20,.74)','rgba(5,13,20,.90)']:['rgba(5,13,20,0)','rgba(5,13,20,.58)','rgba(5,13,20,.90)']} locations={photoHeroHeight>basePhotoHeroHeight?[0,.48,1]:[0,.52,1]} style={StyleSheet.absoluteFill}/></>:null}
   <View style={[styles.identity,!hero&&styles.identityFallback]}>
    {profile.location?<Text numberOfLines={2} style={[styles.location,hero&&styles.overlayText]}>{profile.location}</Text>:null}
    <Text accessibilityRole="header" style={[styles.name,!hero&&styles.nameFallback,hero&&styles.overlayText]}>{profile.name}</Text>
    {copy.headline?.trim()&&copy.headline.trim().toLowerCase()!==profile.name.toLowerCase()?<Text style={[styles.headline,hero&&styles.overlayText]}>{copy.headline.trim()}</Text>:null}
   </View>
  </View>
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {profile.description?<Text numberOfLines={3} style={styles.description}>{profile.description}</Text>:null}
  {profile.inquiryListing||profile.phoneHref||profile.email||profile.website?<Pressable accessibilityRole="button" onPress={contact} style={styles.primary}><Text style={styles.primaryText}>{copy.contact_title?.trim()||'Request an estimate'}</Text><Text style={styles.arrow}>→</Text></Pressable>:null}
  <View style={styles.sectionHead}><Text accessibilityRole="header" style={styles.sectionTitle}>{copy.offerings_title?.trim()||'Services'}</Text><Text style={styles.count}>{profile.serviceOfferings.total||profile.serviceOfferings.items.length}</Text></View>
  {profile.serviceOfferings.items.length||profile.serviceOfferings.bounded?<ServiceOfferings offerings={profile.serviceOfferings} appearance={appearance}/>:<View style={styles.empty}><Text style={styles.emptyText}>Service details unavailable.</Text></View>}
  {profile.gallery.length?<View style={styles.proof}><Text style={styles.sectionTitle}>Recent work</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>{profile.gallery.slice(0,8).map((uri,i)=><Image key={uri} source={{uri}} accessibilityLabel={'Work photo '+(i+1)} resizeMode="cover" style={styles.workImage}/>)}</ScrollView></View>:null}
  {!profile.inquiryListing&&!profile.phoneHref&&!profile.email&&!profile.website?<Text style={styles.emptyText}>Contact details are not available.</Text>:null}
  <Text style={styles.disclosure}>{profile.inquiryListing?'Send a request. A visit or price is not confirmed until the business replies.':''}</Text>
 </ScrollView>
}
function makeStyles(a:Appearance,dark:boolean){
 const bg=dark?'#0D1722':a.background,surface=dark?'#142535':a.surface,ink=dark?'#F3F6FA':a.ink,muted=dark?'#B7C4D1':a.muted,line=dark?'#33495E':a.line,primary=dark&&a.primaryColor==='#FFFFFF'?'#245EAB':a.primaryColor;
 return StyleSheet.create({screen:{flex:1,backgroundColor:bg},content:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:14,paddingTop:2,paddingBottom:24,gap:10},top:{height:44,flexDirection:'row',alignItems:'center',gap:10},spacer:{flex:1},icon:{width:44,height:44,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:surface,borderWidth:1,borderColor:line},iconText:{fontSize:22,lineHeight:26,color:ink},clientLogo:{width:42,height:36,borderRadius:10,backgroundColor:surface,borderWidth:1,borderColor:line},hero:{borderRadius:20,overflow:'hidden',backgroundColor:surface,justifyContent:'flex-end'},identity:{paddingHorizontal:17,paddingVertical:15,gap:4},identityFallback:{borderWidth:1,borderColor:line,borderRadius:20,paddingVertical:11},location:{fontSize:12,lineHeight:16,color:muted},name:{fontFamily:'Georgia',fontSize:25,lineHeight:30,color:ink,letterSpacing:-.35},nameFallback:{fontFamily:Platform.select({ios:'System',android:'sans-serif',default:'system-ui'}),fontSize:21,lineHeight:26,fontWeight:'600',letterSpacing:-.3},headline:{fontSize:13,lineHeight:18,color:muted},overlayText:{color:'#FFFFFF',textShadowColor:'rgba(0,0,0,.7)',textShadowRadius:5},description:{fontSize:13,lineHeight:19,color:muted},sectionHead:{flexDirection:'row',alignItems:'baseline',gap:9},sectionTitle:{fontSize:16,lineHeight:21,color:ink,fontWeight:'600'},count:{fontSize:11,lineHeight:16,color:muted},empty:{padding:12,backgroundColor:surface,borderColor:line,borderWidth:1,borderRadius:14},emptyText:{fontSize:13,lineHeight:19,color:muted},proof:{gap:8},gallery:{gap:9},workImage:{width:150,height:112,borderRadius:14,backgroundColor:surface},primary:{minHeight:48,borderRadius:15,backgroundColor:primary,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},primaryText:{fontSize:14,lineHeight:19,fontWeight:'700',color:'#FFFFFF'},arrow:{fontSize:21,color:'#FFFFFF'},disclosure:{fontSize:11,lineHeight:16,color:muted},error:{fontSize:13,lineHeight:19,color:dark?'#FF9EA7':'#B42332'}})
}
