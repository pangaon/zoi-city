import {useEffect,useRef,useState} from "react";
import {ScaleText as Text} from './ScaleText';
import {ActivityIndicator,Linking,Pressable,StyleSheet,View} from "react-native";
import {WebView} from "react-native-webview";
import {LIGHT} from "./brand";
import {fullMapToolsLink} from "./discovery";
import type {DiscoveryMapProps} from "./DiscoveryMap.types";
import {embeddedMapDocument,embeddedMapPayload,embeddedMapCommand,embeddedMapMessage} from "../../assets/map-data/embedded.mjs";
import {useMapLocation} from './useMapLocation';
import {MapLocationControl} from './MapLocationControl';
import {embeddedLocationCommand} from '../../assets/map-data/embedded.mjs';
const documentHTML=embeddedMapDocument(),base="https://www.zoi.city",documentSource={html:documentHTML,baseUrl:base+"/"};
export function DiscoveryMap(props:DiscoveryMapProps){
 const [locationOptions,setLocationOptions]=useState(false);
 const web=useRef<WebView>(null),current=useRef(props),previous=useRef({scope:"",selected:"",focus:0}),alive=useRef(true);
 current.current=props;
 const cameraIntent=useRef(0),selectionIntent=useRef({selected:'',focus:0,epoch:0});
 const location=useMapLocation(props.scopeKey,(fix,{center})=>web.current?.injectJavaScript(embeddedLocationCommand(fix,{center,motion:props.motion})));
 useEffect(()=>{location.manualMove();},[props.selected,props.focus]);

 const [ready,setReady]=useState(false),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[opening,setOpening]=useState(false);
 useEffect(()=>{if(ready)web.current?.injectJavaScript(embeddedLocationCommand(location.state.fix));},[ready,location.state.fix]);
 useEffect(()=>{if(error)location.clear();},[error]);
 const viewport=useRef({latitude:37,longitude:15,longitudeDelta:160,width:350});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!ready)return;
  const p=current.current,before=previous.current;
  if(selectionIntent.current.selected!==p.selected||selectionIntent.current.focus!==p.focus)selectionIntent.current={selected:p.selected,focus:p.focus,epoch:cameraIntent.current};
  const payload=embeddedMapPayload(p.points,p.selected,{fit:before.scope!==p.scopeKey,focus:before.focus!==p.focus,motion:p.motion,selectionFocus:selectionIntent.current.epoch===cameraIntent.current});
  web.current?.injectJavaScript(embeddedMapCommand(payload));
  previous.current={scope:payload.points.length?p.scopeKey:before.scope,selected:p.selected,focus:p.focus};
 },[ready,props.points,props.selected,props.scopeKey,props.focus,props.motion]);
 useEffect(()=>{if(ready||error)return;const timer=setTimeout(()=>{if(alive.current)setError("The interactive map could not load. Your places are still in the list.");},18000);return()=>clearTimeout(timer);},[ready,error,attempt]);
 const open=async(url:string)=>{try{const value=new URL(url);if(value.protocol!=="https:"||value.username||value.password)throw Error("invalid_link");await Linking.openURL(value.href);}catch{if(alive.current)setError("This link could not open. Please try again.");}};
 return <View style={{gap:8}}><View style={[s.frame,{height:props.height ?? 340}]} onLayout={e=>{viewport.current.width=e.nativeEvent.layout.width;web.current?.injectJavaScript("window.ZoiEmbeddedMap?.resize();true;");}}>
  <WebView key={attempt} ref={web} source={documentSource} style={StyleSheet.absoluteFill} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} geolocationEnabled={false} setSupportMultipleWindows
   onShouldStartLoadWithRequest={request=>{if(["about:blank",base,base+"/"].includes(request.url))return true;void open(request.url);return false;}}
   onOpenWindow={event=>{void open(event.nativeEvent.targetUrl);}}
   onMessage={event=>{if(!alive.current)return;if(!["about:blank",base,base+"/"].includes(event.nativeEvent.url))return;const message=embeddedMapMessage(event.nativeEvent.data,current.current.points);if(message?.type==="map.ready"){setError("");setReady(true);}else if(message?.type==="map.error")setError("The interactive map could not load. Your places are still in the list.");else if(message?.type==="map.interaction"){cameraIntent.current++;location.manualMove();previous.current.scope=current.current.scopeKey;}else if(message?.type==="map.select"){cameraIntent.current++;location.manualMove();previous.current.scope=current.current.scopeKey;current.current.onSelect(message.slug);}else if(message?.type==="map.view"&&typeof message.longitudeDelta==="number")viewport.current={...viewport.current,...message,longitudeDelta:message.longitudeDelta*viewport.current.width/512};}}
   onError={()=>setError("The interactive map could not load. Your places are still in the list.")}
   onContentProcessDidTerminate={()=>{setReady(false);setError("The map closed. Try loading it again.");}}/>


  {!ready||error?<View style={s.note}>{!error?<ActivityIndicator color={LIGHT.accent}/>:null}<Text style={s.text}>{error||"Opening the map…"}</Text>{error?<Pressable accessibilityRole="button" style={s.retry} onPress={()=>{setReady(false);setError("");previous.current={scope:"",selected:"",focus:0};setAttempt(v=>v+1);}}><Text style={s.link}>Retry interactive map</Text></Pressable>:null}</View>:null}
 </View>
 <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}><Pressable accessibilityRole="link" accessibilityLabel="Open full map tools in browser" disabled={opening} style={s.tools} onPress={async()=>{setOpening(true);await open(fullMapToolsLink(props.points.find(p=>p.s===props.selected)||{s:props.selected},viewport.current));if(alive.current)setOpening(false);}}><Text style={s.link}>{opening?"Opening…":"Full map tools ↗"}</Text></Pressable><Pressable accessibilityRole="button" accessibilityState={{expanded:locationOptions}} style={s.tools} onPress={()=>setLocationOptions(v=>!v)}><Text style={s.link}>{locationOptions?"Close location options":"Location options"}</Text></Pressable></View>
 {locationOptions&&ready&&!error?<MapLocationControl inline state={location.state} onRequest={()=>{cameraIntent.current++;previous.current.scope=current.current.scopeKey;location.request();}} onClear={location.clear}/>:null}
 </View>;
}
const s=StyleSheet.create({frame:{height:340,borderRadius:24,overflow:"hidden",backgroundColor:LIGHT.surfaceRaised,borderWidth:1,borderColor:LIGHT.line},retry:{minHeight:44,minWidth:44,justifyContent:"center"},tools:{minHeight:44,minWidth:44,justifyContent:"center",flexShrink:1,borderRadius:10,padding:10,backgroundColor:LIGHT.surface,borderWidth:1,borderColor:LIGHT.line},link:{color:LIGHT.accent,fontWeight:"700",fontSize:12},note:{position:"absolute",left:12,right:12,bottom:12,padding:12,borderRadius:12,backgroundColor:LIGHT.surface,gap:8},text:{color:LIGHT.muted,fontSize:12}});
