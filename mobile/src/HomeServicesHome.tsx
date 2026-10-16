import {useMemo,useState} from 'react';
import {ScaleText as Text} from './ScaleText';
import {Image,Linking,Pressable,ScrollView,Share,StyleSheet,useColorScheme,useWindowDimensions,View} from 'react-native';
import type {NativeServiceOfferings} from './serviceOfferings';
import {ServiceOfferings} from './ServiceOfferings';

type Appearance={background:string;ink:string;muted:string;accent:string;primaryColor:string;surface:string;line:string;copy?:Record<string,string>};
type Profile={id:string;name:string;slug?:string;location?:string;photo?:string;gallery:string[];description?:string;website?:string;phoneHref?:string|null;email?:string;inquiryListing?:string;serviceOfferings:NativeServiceOfferings;publishedDesign?:{copy?:Record<string,string>}|null};

/** Local service journey: clear scope, request a quote, and only verified ways to contact. */
export function HomeServicesHome({profile,appearance,back,enquiry}:{profile:Profile;appearance:Appearance;back:()=>void;enquiry:(listing:string)=>void}){
 const dark=useColorScheme()==='dark', {width}=useWindowDimensions(), [heroFailed,setHeroFailed]=useState(false),[error,setError]=useState('');
 const copy=profile.publishedDesign?.copy||appearance.copy||{}, hero=!!profile.photo&&!heroFailed;
 const styles=useMemo(()=>makeStyles(appearance,dark),[appearance,dark]);
 const open=async(url:string)=>{setError('');try{await Linking.openURL(url)}catch{setError('Could not open that link. Try another contact option.')}};
 const contact=()=>{if(profile.inquiryListing)enquiry(profile.inquiryListing);else if(profile.phoneHref)void open(profile.phoneHref);else if(profile.email)void open('mailto:'+encodeURIComponent(profile.email));else if(profile.website)void open(profile.website)};
 const share=async()=>{try{await Share.share({title:profile.name,message:[profile.name,profile.location,'https://www.zoi.city/p/'+encodeURIComponent(profile.slug||'')].filter(Boolean).join(' · ')})}catch{setError('Sharing is unavailable.')}};
 return <ScrollView testID="home-services-home" keyboardShouldPersistTaps="handled" style={styles.screen} contentContainerStyle={styles.content}>
  <View style={styles.top}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.icon}><Text style={styles.iconText}>‹</Text></Pressable><View style={styles.spacer}/><Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void share()} style={styles.icon}><Text style={styles.iconText}>↗</Text></Pressable></View>
  <View style={[styles.hero,{height:hero?Math.max(210,Math.min(300,width*.62)):undefined,minHeight:hero?210:0}]}>
   {hero?<Image source={{uri:profile.photo}} accessibilityLabel={profile.name+' business'} resizeMode="cover" onError={()=>setHeroFailed(true)} style={StyleSheet.absoluteFill}/>:null}
   <View style={[styles.identity,!hero&&styles.identityFallback]}>
    {profile.location?<Text numberOfLines={2} style={[styles.location,hero&&styles.overlayText]}>{profile.location}</Text>:null}
    <Text accessibilityRole="header" style={[styles.name,hero&&styles.overlayText]}>{profile.name}</Text>
    {copy.headline?.trim()&&copy.headline.trim().toLowerCase()!==profile.name.toLowerCase()?<Text style={[styles.headline,hero&&styles.overlayText]}>{copy.headline.trim()}</Text>:null}
   </View>
  </View>
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}
  {profile.description?<Text style={styles.description}>{profile.description}</Text>:null}
  {profile.inquiryListing||profile.phoneHref||profile.email||profile.website?<Pressable accessibilityRole="button" onPress={contact} style={styles.primary}><Text style={styles.primaryText}>{copy.contact_title?.trim()||'Request an estimate'}</Text><Text style={styles.arrow}>→</Text></Pressable>:null}
  <View style={styles.sectionHead}><Text accessibilityRole="header" style={styles.sectionTitle}>{copy.offerings_title?.trim()||'Services'}</Text><Text style={styles.count}>{profile.serviceOfferings.total||profile.serviceOfferings.items.length}</Text></View>
  {profile.serviceOfferings.items.length||profile.serviceOfferings.bounded?<ServiceOfferings offerings={profile.serviceOfferings} appearance={appearance}/>:<View style={styles.empty}><Text style={styles.emptyTitle}>Service details coming soon</Text><Text style={styles.emptyText}>Contact {profile.name} for current service information.</Text></View>}
  {profile.gallery.length?<View style={styles.proof}><Text style={styles.sectionTitle}>Recent work</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>{profile.gallery.slice(0,8).map((uri,i)=><Image key={uri} source={{uri}} accessibilityLabel={'Work photo '+(i+1)} resizeMode="cover" style={styles.workImage}/>)}</ScrollView></View>:null}
  {!profile.inquiryListing&&!profile.phoneHref&&!profile.email&&!profile.website?<Text style={styles.emptyText}>Contact details are not available.</Text>:null}
  <Text style={styles.disclosure}>{profile.inquiryListing?'Send a request. A visit or price is not confirmed until the business replies.':''}</Text>
 </ScrollView>
}
function makeStyles(a:Appearance,dark:boolean){
 const bg=dark?'#0D1722':a.background,surface=dark?'#142535':a.surface,ink=dark?'#F3F6FA':a.ink,muted=dark?'#B7C4D1':a.muted,line=dark?'#33495E':a.line,primary=dark&&a.primaryColor==='#FFFFFF'?'#245EAB':a.primaryColor;
 return StyleSheet.create({screen:{flex:1,backgroundColor:bg},content:{width:'100%',maxWidth:720,alignSelf:'center',paddingHorizontal:14,paddingTop:2,paddingBottom:24,gap:12},top:{height:44,flexDirection:'row',alignItems:'center',gap:10},spacer:{flex:1},icon:{width:44,height:44,borderRadius:21,alignItems:'center',justifyContent:'center',backgroundColor:surface,borderWidth:1,borderColor:line},iconText:{fontSize:22,lineHeight:26,color:ink},hero:{borderRadius:20,overflow:'hidden',backgroundColor:surface,justifyContent:'flex-end'},identity:{paddingHorizontal:17,paddingVertical:15,gap:4},identityFallback:{borderWidth:1,borderColor:line,borderRadius:20},location:{fontSize:12,lineHeight:16,color:muted},name:{fontFamily:'Georgia',fontSize:25,lineHeight:30,color:ink,letterSpacing:-.35},headline:{fontSize:14,lineHeight:20,color:muted},overlayText:{color:'#FFFFFF',textShadowColor:'rgba(0,0,0,.7)',textShadowRadius:5},description:{fontSize:14,lineHeight:20,color:muted},sectionHead:{flexDirection:'row',alignItems:'baseline',gap:9},sectionTitle:{fontSize:17,lineHeight:22,color:ink,fontWeight:'600'},count:{fontSize:12,lineHeight:17,color:muted},empty:{padding:15,backgroundColor:surface,borderColor:line,borderWidth:1,borderRadius:16,gap:5},emptyTitle:{fontSize:15,lineHeight:20,color:ink,fontWeight:'600'},emptyText:{fontSize:13,lineHeight:19,color:muted},proof:{gap:8},gallery:{gap:9},workImage:{width:150,height:112,borderRadius:14,backgroundColor:surface},primary:{minHeight:50,borderRadius:16,backgroundColor:primary,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},primaryText:{fontSize:15,lineHeight:20,fontWeight:'700',color:'#FFFFFF'},arrow:{fontSize:21,color:'#FFFFFF'},disclosure:{fontSize:11,lineHeight:16,color:muted},error:{fontSize:13,lineHeight:19,color:dark?'#FF9EA7':'#B42332'}})
}
