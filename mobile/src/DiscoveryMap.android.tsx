import {useEffect,useRef,useState} from "react";
import {ActivityIndicator,Linking,Pressable,StyleSheet,Text,View} from "react-native";
import {WebView} from "react-native-webview";
import {LIGHT} from "./brand";
import {fullMapToolsLink} from "./discovery";
import type {DiscoveryMapProps} from "./DiscoveryMap.types";
import {embeddedMapDocument,embeddedMapPayload,embeddedMapCommand,embeddedMapMessage} from "../../assets/map-data/embedded.mjs";
const documentHTML=embeddedMapDocument(),base="https://www.zoi.city";
export function DiscoveryMap(props:DiscoveryMapProps){
 const web=useRef<WebView>(null),current=useRef(props),previous=useRef({scope:"",selected:"",focus:0}),alive=useRef(true);
 current.current=props;
 const [ready,setReady]=useState(false),[error,setError]=useState(""),[attempt,setAttempt]=useState(0),[opening,setOpening]=useState(false);
 const viewport=useRef({latitude:37,longitude:15,longitudeDelta:160,width:350});
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!ready)return;
  const p=current.current,before=previous.current;
  const payload=embeddedMapPayload(p.points,p.selected,{fit:before.scope!==p.scopeKey,focus:before.focus!==p.focus,motion:p.motion});
  web.current?.injectJavaScript(embeddedMapCommand(payload));
  previous.current={scope:payload.points.length?p.scopeKey:before.scope,selected:p.selected,focus:p.focus};
 },[ready,props.points,props.selected,props.scopeKey,props.focus,props.motion]);
 useEffect(()=>{if(ready||error)return;const timer=setTimeout(()=>{if(alive.current)setError("The interactive map could not load. Your places are still in the list.");},18000);return()=>clearTimeout(timer);},[ready,error,attempt]);
 const open=async(url:string)=>{try{const value=new URL(url);if(value.protocol!=="https:"||value.username||value.password)throw Error("invalid_link");await Linking.openURL(value.href);}catch{if(alive.current)setError("This link could not open. Please try again.");}};
 return <View style={s.frame} onLayout={e=>{viewport.current.width=e.nativeEvent.layout.width;}}>
  <WebView key={attempt} ref={web} source={{html:documentHTML,baseUrl:base+"/"}} style={StyleSheet.absoluteFill} originWhitelist={["*"]} javaScriptEnabled domStorageEnabled incognito sharedCookiesEnabled={false} thirdPartyCookiesEnabled={false} geolocationEnabled={false} setSupportMultipleWindows
   onShouldStartLoadWithRequest={request=>{if(["about:blank",base,base+"/"].includes(request.url))return true;void open(request.url);return false;}}
   onOpenWindow={event=>{void open(event.nativeEvent.targetUrl);}}
   onMessage={event=>{if(!alive.current)return;if(!["about:blank",base,base+"/"].includes(event.nativeEvent.url))return;const message=embeddedMapMessage(event.nativeEvent.data,current.current.points);if(message?.type==="map.ready"){setError("");setReady(true);}else if(message?.type==="map.error")setError("The interactive map could not load. Your places are still in the list.");else if(message?.type==="map.select")current.current.onSelect(message.slug);else if(message?.type==="map.view"&&typeof message.longitudeDelta==="number")viewport.current={...viewport.current,...message,longitudeDelta:message.longitudeDelta*viewport.current.width/512};}}
   onError={()=>setError("The interactive map could not load. Your places are still in the list.")}
   onContentProcessDidTerminate={()=>{setReady(false);setError("The map closed. Try loading it again.");}}/>
  <Pressable accessibilityRole="link" accessibilityLabel="Open full map tools in browser" disabled={opening} style={s.tools} onPress={async()=>{setOpening(true);await open(fullMapToolsLink(props.points.find(p=>p.s===props.selected)||{s:props.selected},viewport.current));if(alive.current)setOpening(false);}}><Text style={s.link}>{opening?"Opening…":"Full map tools ↗"}</Text></Pressable>
  {!ready||error?<View style={s.note}>{!error?<ActivityIndicator color={LIGHT.accent}/>:null}<Text style={s.text}>{error||"Opening the map…"}</Text>{error?<Pressable accessibilityRole="button" onPress={()=>{setReady(false);setError("");previous.current={scope:"",selected:"",focus:0};setAttempt(v=>v+1);}}><Text style={s.link}>Retry interactive map</Text></Pressable>:null}</View>:null}
 </View>;
}
const s=StyleSheet.create({frame:{height:340,borderRadius:24,overflow:"hidden",backgroundColor:LIGHT.surfaceRaised,borderWidth:1,borderColor:LIGHT.line},tools:{position:"absolute",top:12,left:12,borderRadius:10,padding:10,backgroundColor:LIGHT.surface,borderWidth:1,borderColor:LIGHT.line},link:{color:LIGHT.accent,fontWeight:"700",fontSize:12},note:{position:"absolute",left:12,right:12,bottom:12,padding:12,borderRadius:12,backgroundColor:LIGHT.surface,gap:8},text:{color:LIGHT.muted,fontSize:12}});
