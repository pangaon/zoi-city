import {useMemo,useRef,useState} from 'react';
import {ScaleText as Text} from './ScaleText';
import {Image,ImageStyle,Linking,Pressable,SafeAreaView,ScrollView,Share,StyleSheet,View,useWindowDimensions} from 'react-native';
import {LinearGradient} from 'expo-linear-gradient';
import {BookingPanel} from './Bookings';
import {FoodMenu} from './FoodMenu';
import type {NativeFood} from './foodMenu';

type Design={background:string;ink:string;muted:string;accent:string;primaryColor:string;surface:string;line:string;copy?:Record<string,string>};
type Profile={id:string;name:string;slug:string;location:string;address:string;description:string;photo:string;logo:string;gallery:string[];website:string;phoneHref:string|null;food:NativeFood;bookingListing:string;inquiryListing:string;verified:boolean};
type Props={profile:Profile;design:Design;back:()=>void;signIn:()=>void;enquiry:(id:string)=>void};

/** Food-first home: identity and published menu lead; every customer action stays tied to this listing. */
export function FoodBusinessHome({profile,design,back,signIn,enquiry}:Props){
 const food=profile.food;
 const [tab,setTab]=useState<'menu'|'details'>('menu'),[failedHero,setFailedHero]=useState(false),[failedLogo,setFailedLogo]=useState(false),[failed,setFailed]=useState<Record<string,boolean>>({});
 const {width,fontScale}=useWindowDimensions(),scroll=useRef<ScrollView>(null),menuTop=useRef(0),scale=fontScale||1;
 const s=useMemo(()=>styles(design),[design]),hero=!!profile.photo&&!failedHero,photos=profile.gallery.filter(url=>url!==profile.photo&&!failed[url]);
 const copy=design.copy||{},bakery=food.family==='bakery';
 const title=profile.name,subtitle=(copy.headline||'').trim();
 const titleLines=Math.max(1,Math.ceil(title.length/Math.max(8,(width-68)/(17*scale)))),identityHeight=62+scale*(24+31*titleLines+(profile.location?16:0)+(subtitle?20:0));
 const heroHeight=hero?Math.max(270,width*.83,identityHeight):Math.max(96,identityHeight);
 const open=async(url:string)=>{try{await Linking.openURL(url)}catch{}}
 const hasMenu=food.menuSections.some(section=>section.items.length>0);
 const primary=profile.bookingListing?'Reserve':hasMenu?'View menu':profile.inquiryListing?'Contact':profile.phoneHref?'Call':profile.website?'Website':'';
 const act=()=>{if(profile.bookingListing){setTab('details');scroll.current?.scrollToEnd({animated:true});return}if(hasMenu){visitMenu();return}if(profile.inquiryListing){enquiry(profile.inquiryListing);return}if(profile.phoneHref){void open(profile.phoneHref);return}if(profile.website)void open(profile.website)};
 const visitMenu=()=>{setTab('menu');scroll.current?.scrollTo({y:Math.max(0,menuTop.current-12),animated:true})};
 const url='https://www.zoi.city/p/'+encodeURIComponent(profile.slug);
 if(tab==='details'&&profile.bookingListing)return <SafeAreaView style={s.screen}><ScrollView ref={scroll} style={s.screen} contentContainerStyle={s.content}><Pressable accessibilityRole="button" onPress={()=>setTab('menu')} style={s.back}><Text style={s.backText}>‹  {title}</Text></Pressable><Text accessibilityRole="header" style={s.sectionTitle}>Reservations</Text><BookingPanel listingId={profile.bookingListing} signIn={signIn}/></ScrollView></SafeAreaView>;
 return <SafeAreaView style={s.screen}>
  <ScrollView ref={scroll} testID="food-business-home" style={s.screen} contentContainerStyle={s.content}>
   <View style={s.top}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back to Explore" onPress={back} style={s.round}><Text allowFontScaling={false} style={s.icon}>‹</Text></Pressable>
    <View style={s.brand}>{profile.logo&&!failedLogo?<Image source={{uri:profile.logo}} resizeMode="contain" accessibilityLabel={title+' logo'} style={s.logo as ImageStyle} onError={()=>setFailedLogo(true)}/>:<Text style={s.wordmark}>{bakery?'BAKERY':'DINING'}</Text>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={()=>void Share.share({title,message:title+(profile.location?' · '+profile.location:'')+'\n'+url}).catch(()=>{})} style={s.round}><Text allowFontScaling={false} style={s.icon}>↗</Text></Pressable>
   </View>
   <View style={[s.hero,{height:heroHeight},!hero&&s.emptyCard]} testID="profile-hero">
    {hero?<Image source={{uri:profile.photo}} resizeMode="cover" accessibilityLabel={title} style={StyleSheet.absoluteFill} onError={()=>setFailedHero(true)}/>:<View style={[StyleSheet.absoluteFill,s.emptyHero]}/>}
    {hero?<LinearGradient pointerEvents="none" colors={['rgba(7,12,17,0)','rgba(7,12,17,.22)','rgba(7,12,17,.87)']} locations={[0,.4,1]} style={StyleSheet.absoluteFill}/>:null}
    <View style={s.identity}>
     {profile.location?<Text style={[s.location,!hero&&{color:design.muted}]}>{profile.location}</Text>:null}
     <Text accessibilityRole="header" style={[s.name,!hero&&{color:design.ink}]}>{title}</Text>
     {subtitle&&subtitle.toLowerCase()!==title.toLowerCase()?<Text style={[s.subtitle,!hero&&{color:design.muted}]}>{subtitle}</Text>:null}
    </View>
   </View>
   {primary?<Pressable accessibilityRole="button" onPress={act} style={({pressed})=>[s.primary,{backgroundColor:design.primaryColor},pressed&&{opacity:.84}]}><Text style={s.primaryText}>{primary}</Text><Text allowFontScaling={false} style={s.primaryArrow}>→</Text></Pressable>:null}
   <View style={s.tabRow} accessibilityRole="tablist" accessibilityLabel={title+' sections'}>
    <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='menu'}} onPress={visitMenu} style={[s.tab,tab==='menu'&&{borderColor:design.accent}]}><Text style={s.tabText}>{bakery?'Bakery':'Menu'}</Text></Pressable>
    <Pressable accessibilityRole="tab" accessibilityState={{selected:tab==='details'}} onPress={()=>setTab('details')} style={[s.tab,tab==='details'&&{borderColor:design.accent}]}><Text style={s.tabText}>Details</Text></Pressable>
   </View>
   {tab==='menu'?<View testID="profile-section-offerings" onLayout={e=>{menuTop.current=e.nativeEvent.layout.y}}><Text accessibilityRole="header" style={s.sectionTitle}>{copy.offerings_title?.trim()|| (bakery?'From the bakery':'Menu')}</Text><FoodMenu food={food} appearance={design}/></View>:<View style={s.details}>
    {profile.description?<><Text accessibilityRole="header" style={s.sectionTitle}>About</Text><Text style={s.body}>{profile.description}</Text></>:null}
    {profile.address?<Text selectable style={s.body}>{profile.address}</Text>:null}
    {profile.verified?<Text style={s.verified}>Verified</Text>:null}
    {photos.length?<><Text accessibilityRole="header" style={s.sectionTitle}>Photos</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.gallery}>{photos.map((uri,index)=><Image key={uri} source={{uri}} accessibilityLabel={title+' photo '+(index+1)} resizeMode="cover" style={s.photo as ImageStyle} onError={()=>setFailed(old=>({...old,[uri]:true}))}/>)}</ScrollView></>:null}
    <View style={s.links}>{profile.website?<Pressable accessibilityRole="link" onPress={()=>void open(profile.website)} style={s.link}><Text style={s.linkText}>Website ↗</Text></Pressable>:null}{profile.phoneHref?<Pressable accessibilityRole="link" onPress={()=>void open(profile.phoneHref!)} style={s.link}><Text style={s.linkText}>Call</Text></Pressable>:null}</View>
   </View>}
  </ScrollView>
 </SafeAreaView>
}
function styles(d:Design){return StyleSheet.create({screen:{flex:1,backgroundColor:d.background},content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:16,paddingTop:6,paddingBottom:30,gap:12},top:{height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},round:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:d.line,backgroundColor:d.surface,alignItems:'center',justifyContent:'center'},icon:{fontSize:23,lineHeight:28,color:d.ink},brand:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8},logo:{width:42,height:34,borderRadius:8,backgroundColor:'#fff'},wordmark:{fontFamily:'Georgia',fontSize:13,lineHeight:18,letterSpacing:1.4,color:d.muted,fontWeight:'600'},hero:{borderRadius:22,overflow:'hidden',justifyContent:'flex-end',backgroundColor:d.surface},emptyCard:{justifyContent:'center',borderWidth:1,borderColor:d.line},emptyHero:{backgroundColor:d.surface},identity:{padding:18,gap:5},location:{fontSize:11,lineHeight:15,letterSpacing:.7,color:'#F4F2EC'},name:{fontFamily:'Georgia',fontSize:29,lineHeight:33,fontWeight:'400',letterSpacing:-.5,color:'#FFFFFF'},subtitle:{fontSize:13,lineHeight:18,color:'#F3F1EB'},primary:{minHeight:48,paddingHorizontal:16,borderRadius:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},primaryText:{fontSize:14,lineHeight:19,fontWeight:'600',color:'#fff'},primaryArrow:{fontSize:20,lineHeight:23,color:'#fff'},tabRow:{flexDirection:'row',gap:18,borderBottomWidth:1,borderColor:d.line},tab:{minHeight:43,paddingHorizontal:4,justifyContent:'center',borderBottomWidth:2,borderColor:'transparent'},tabText:{fontSize:13,lineHeight:18,fontWeight:'600',color:d.ink},sectionTitle:{fontFamily:'Georgia',fontSize:20,lineHeight:25,fontWeight:'400',color:d.ink,marginBottom:8},details:{gap:12,paddingVertical:4},body:{fontSize:14,lineHeight:20,color:d.muted},verified:{fontSize:11,lineHeight:16,fontWeight:'600',color:d.accent},gallery:{gap:8},photo:{width:Math.min(250,280),height:170,borderRadius:14,backgroundColor:d.surface},links:{flexDirection:'row',flexWrap:'wrap',gap:8},link:{minHeight:44,justifyContent:'center',paddingHorizontal:14,borderRadius:22,borderWidth:1,borderColor:d.line,backgroundColor:d.surface},linkText:{fontSize:13,lineHeight:18,fontWeight:'600',color:d.accent},back:{minHeight:44,justifyContent:'center'},backText:{fontSize:15,lineHeight:20,fontWeight:'600',color:d.ink}})}
