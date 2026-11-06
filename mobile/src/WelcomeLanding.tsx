import {useRef,useState} from 'react';
import {ActivityIndicator,Image,Linking,Platform,Pressable,SafeAreaView,ScrollView,StatusBar as NativeStatusBar,StyleSheet,useWindowDimensions,View} from 'react-native';
import {StatusBar} from 'expo-status-bar';
import {BlurTargetView,BlurView} from 'expo-blur';
import {LinearGradient} from 'expo-linear-gradient';
import {ScaleText as Text} from './ScaleText';
import {AegeanArt} from './AegeanArt';
import {Icon} from './Icon';
import {usePresentationPreferences} from './Presentation';
import type {WelcomeDestination} from './Welcome';

const INK='#071d50';
const DISPLAY=Platform.OS==='ios'?'Georgia':Platform.OS==='android'?'serif':'Georgia, serif';

export function WelcomeLanding({checking=false,saving=false,onChoose}:{checking?:boolean;saving?:boolean;onChoose:(destination:WelcomeDestination)=>void}){
 const {width,height,fontScale}=useWindowDimensions(),compact=height<740||fontScale>1.3,stacked=width/fontScale<240;
 const {glass}=usePresentationPreferences(),scene=useRef<View|null>(null);
 const [privacyError,setPrivacyError]=useState(false),[openingPrivacy,setOpeningPrivacy]=useState(false);
 const busy=checking||saving;
 const privacy=async()=>{if(openingPrivacy)return;setOpeningPrivacy(true);setPrivacyError(false);try{await Linking.openURL('https://www.zoi.city/privacy/');}catch{setPrivacyError(true);}finally{setOpeningPrivacy(false);}};
 return <View style={s.frame}>
  <BlurTargetView ref={scene} style={StyleSheet.absoluteFill}><AegeanArt animated opening/></BlurTargetView>
  <StatusBar style="dark"/>
  <SafeAreaView style={s.safe}>
   <ScrollView contentContainerStyle={[s.content,compact&&s.compactContent]} keyboardShouldPersistTaps="handled">
    <View style={[s.hero,compact&&s.compactHero,stacked&&s.readingHero]}>
     <View style={s.brand}><Image source={require('../assets/zoi-logo.png')} resizeMode="contain" style={[s.emblem,compact&&s.compactEmblem]} accessible={false}/><Text style={[s.wordmark,compact&&s.compactWordmark]}>Zoi</Text></View>
     <Text style={s.eyebrow}>LIFE, TOGETHER.</Text>
     <Text accessibilityRole="header" style={[s.title,compact&&s.compactTitle]}>Your people.{ '\n' }Your possibilities.</Text>
    </View>
    <View style={[s.panel,!glass&&s.opaquePanel]}>
     {glass?<BlurView blurTarget={scene} blurMethod="dimezisBlurViewSdk31Plus" intensity={38} tint="light" pointerEvents="none" style={StyleSheet.absoluteFill}/>:null}
     <View style={s.panelContent}>
      <View style={[s.routes,stacked&&s.routesStacked]}>
       {([{id:'community',label:'Community',icon:'community'},{id:'discover',label:'Discover',icon:'discover'},{id:'grow',label:'Create',icon:'grow'}]as const).map(route=><Pressable key={route.id} accessibilityRole="button" accessibilityLabel={'Open '+route.label} accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>onChoose(route.id)} style={({pressed})=>[s.route,stacked&&s.routeStacked,pressed&&s.pressed,busy&&s.disabled]}><View style={s.routeIcon}><Icon name={route.icon} size={23} color={INK}/></View><Text style={s.routeLabel}>{route.label}</Text></Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Explore Zoi" accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>onChoose('home')} style={({pressed})=>[s.primary,pressed&&s.pressed,busy&&s.disabled]}>
       <LinearGradient colors={['#0088ff','#034dff']} start={{x:0,y:0}} end={{x:1,y:1}} style={StyleSheet.absoluteFill}/>
       {busy?<ActivityIndicator color="#fff" accessibilityLabel="Opening Zoi"/>:null}<Text style={s.primaryLabel}>{busy?'Opening Zoi…':'Explore Zoi'}</Text>{!busy?<Icon name="arrow" size={23} color="#fff"/>:null}
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Sign in to Zoi" accessibilityState={{disabled:busy}} disabled={busy} onPress={()=>onChoose('grow')} style={({pressed})=>[s.secondary,pressed&&s.pressed,busy&&s.disabled]}><Text style={s.secondaryLabel}>Sign in</Text></Pressable>
      <View style={s.footer}><Pressable accessibilityRole="link" accessibilityLabel="Zoi privacy policy" disabled={openingPrivacy} onPress={()=>void privacy()} style={s.privacy}><Text style={s.privacyLabel}>{openingPrivacy?'Opening…':'Privacy'}</Text></Pressable></View>
      {privacyError?<View style={s.error}><Text accessibilityRole="alert" style={s.errorText}>Privacy could not open. Please try again.</Text><Pressable accessibilityRole="button" onPress={()=>void privacy()} style={s.retry}><Text style={s.privacyLabel}>Retry privacy</Text></Pressable></View>:null}
     </View>
    </View>
   </ScrollView>
  </SafeAreaView>
 </View>;
}

const s=StyleSheet.create({
 frame:{flex:1,backgroundColor:'#eef5fc',overflow:'hidden'},safe:{flex:1,paddingTop:Platform.OS==='android'?NativeStatusBar.currentHeight||0:0},content:{flexGrow:1,justifyContent:'space-between',paddingTop:24,paddingHorizontal:20,paddingBottom:16,gap:22,width:'100%',maxWidth:680,alignSelf:'center'},compactContent:{paddingTop:20,gap:22},
 hero:{alignItems:'center',paddingHorizontal:3,gap:13},compactHero:{gap:9},readingHero:{backgroundColor:'#f9fbffed',borderRadius:28,padding:18},brand:{alignItems:'center',gap:2},emblem:{width:58,height:82},compactEmblem:{width:43,height:62},wordmark:{fontFamily:DISPLAY,fontSize:52,lineHeight:62,letterSpacing:-2.5,color:INK},compactWordmark:{fontSize:44,lineHeight:54,letterSpacing:-2},eyebrow:{fontSize:10,lineHeight:17,letterSpacing:3.4,fontWeight:'600',color:INK,textAlign:'center',marginTop:4},title:{fontFamily:DISPLAY,fontSize:31,lineHeight:35,letterSpacing:-.8,textAlign:'center',color:INK},compactTitle:{fontSize:28,lineHeight:32},
 panel:{borderRadius:28,borderWidth:1,borderColor:'#ffffffd9',backgroundColor:'#f8fbffd6',overflow:'hidden',boxShadow:'0 16px 45px rgba(7,29,80,0.13)'},opaquePanel:{backgroundColor:'#f9fbff'},panelContent:{padding:16,gap:12},routes:{flexDirection:'row',gap:5},routesStacked:{flexDirection:'column',gap:3},route:{flex:1,minWidth:0,minHeight:76,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:5,paddingHorizontal:2},routeStacked:{flex:0,flexDirection:'row',justifyContent:'flex-start',gap:14,paddingHorizontal:8,minHeight:54},routeIcon:{height:39,width:39,borderRadius:20,backgroundColor:'#ffffffcc',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#ffffff',boxShadow:'0 4px 12px rgba(32,78,154,0.08)'},routeLabel:{fontSize:12,lineHeight:18,color:INK,fontWeight:'500',flexShrink:1},
 primary:{minHeight:53,borderRadius:27,borderWidth:1,borderColor:'#4f9bff',overflow:'hidden',paddingHorizontal:22,paddingVertical:13,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:12,boxShadow:'0 7px 19px rgba(0,82,255,0.24)'},primaryLabel:{fontSize:16,lineHeight:23,fontWeight:'600',color:'#fff',flexShrink:1},secondary:{minHeight:49,borderRadius:26,borderWidth:1,borderColor:'#9cafce',paddingHorizontal:16,paddingVertical:11,backgroundColor:'#ffffff38',alignItems:'center',justifyContent:'center'},secondaryLabel:{fontSize:15,lineHeight:22,fontWeight:'600',color:INK},footer:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'},footerNote:{fontSize:10,lineHeight:17,color:'#314b70',flexShrink:1},privacy:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},privacyLabel:{fontSize:12,lineHeight:18,color:INK,fontWeight:'600'},error:{gap:5},errorText:{fontSize:12,lineHeight:18,color:'#8b263a'},retry:{minHeight:44,alignSelf:'flex-start',justifyContent:'center',paddingHorizontal:8},pressed:{opacity:.78},disabled:{opacity:.65},
});
