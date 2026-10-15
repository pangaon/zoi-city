import{useCallback,useEffect,useLayoutEffect,useRef,useState}from'react';
import{Image,Platform,Pressable,ScrollView,StyleSheet,Text,useWindowDimensions,View}from'react-native';
import{SHELL as C}from'./brand';
import{clampNavigationOffset,navigationContentExtent,pageNavigationOffset,revealNavigationOffset,type NavigationBox}from'./navigationLayout';
export const PRIMARY_TABS=[{id:'home',icon:'⌂',label:'Home'},{id:'discover',icon:'◎',label:'Discover'},{id:'community',icon:'☷',label:'Community'},{id:'tickets',icon:'◇',label:'Events'},{id:'grow',icon:'↗',label:'Grow'}]as const;
export type PrimaryTab=typeof PRIMARY_TABS[number]['id'];
type NavigationItem={id:PrimaryTab;icon:string;label:string};
export function AppHeader({onHome,onAccount,accountLabel='Your Zoi ↗',tagline='GREEK ROOTS. GLOBAL LIFE.'}:{onHome:()=>void;onAccount:()=>void;accountLabel?:string;tagline?:string}){
 const{width,fontScale}=useWindowDimensions(),stacked=fontScale>1.3&&width<650;
 const tag=<Text testID="shell-tagline" style={[s.headerTag,stacked&&s.fullTag]}>{stacked?tagline:tagline.replace('. ','.\n')}</Text>;
 return <View style={s.header}><View style={s.headerRow}><Pressable accessibilityRole="button" accessibilityLabel="Zoi home" onPress={onHome} style={s.brandButton}><View style={s.brandLockup}><Image source={require('../assets/zoi-logo.png')} resizeMode="contain" style={s.brandEmblem} accessible={false}/><Text style={s.wordmark}>Zoi</Text></View></Pressable>{!stacked&&tag}<Pressable accessibilityRole="link" accessibilityLabel="Your Zoi account" onPress={onAccount} style={s.account}><Text style={s.accountText}>{accountLabel}</Text></Pressable></View>{stacked&&tag}</View>;
}
export function PrimaryNavigation({activeId,onNavigate,items=PRIMARY_TABS}:{activeId:string;onNavigate:(tab:PrimaryTab)=>void;items?:readonly NavigationItem[]}){
 const{width,fontScale}=useWindowDimensions(),scroll=useRef<ScrollView&{getInnerViewRef:()=>View|null}>(null),boxes=useRef(new Map<string,NavigationBox>()),offset=useRef(0),frame=useRef<number|null>(null);
 const[available,setAvailable]=useState(0),[viewport,setViewport]=useState(0),[nativeContent,setNativeContent]=useState(0),[measured,setMeasured]=useState<{width:number}|null>(null),[position,setPosition]=useState(0);
 const tabRefs=useRef(new Map<string,View>()),measureFrame=useRef<number|null>(null),measureVersion=useRef(0),committedKey=useRef('');
 const measurementKey=JSON.stringify([width,fontScale,viewport,items.map(item=>[item.id,item.label,item.icon])]);
 // Native content-container layout can stay unchanged while scaled tabs grow.
 // Commit a complete measured child union, including tabs whose onLayout did
 // not change. Retain the last settled extent during refresh: clearing it when
 // arrows narrow the viewport would repeatedly insert/remove the arrows.
 const content=measured?.width??nativeContent;
 const refreshMeasurements:(attempt?:number)=>void=useCallback((attempt=0)=>{
  if(committedKey.current!==measurementKey)return;
  const version=++measureVersion.current;
  if(measureFrame.current!==null)cancelAnimationFrame(measureFrame.current);
  measureFrame.current=requestAnimationFrame(()=>{
   measureFrame.current=null;
   if(version!==measureVersion.current)return;
   const ids=(JSON.parse(measurementKey)[3]as string[][]).map(item=>item[0]);
   const next=new Map<string,NavigationBox>(),parent=scroll.current?.getInnerViewRef();
   let retryRequested=false;const retry=()=>{if(!retryRequested&&version===measureVersion.current&&attempt<2){retryRequested=true;refreshMeasurements(attempt+1);}};
   const commit=()=>{if(version!==measureVersion.current)return;const extent=navigationContentExtent(ids,next);if(extent!==null){boxes.current=next;setMeasured({width:extent});}else retry();};
   if(!ids.length){commit();return;}if(!parent){retry();return;}
   for(const id of ids){const tab=tabRefs.current.get(id);if(!tab){retry();continue;}
    try{tab.measureLayout(parent,(x,_y,itemWidth)=>{if(version!==measureVersion.current)return;if(tabRefs.current.get(id)!==tab||scroll.current?.getInnerViewRef()!==parent){retry();return;}next.set(id,{x,width:itemWidth});if(next.size===ids.length)commit();},retry);}catch{retry();}
   }
  });
 },[measurementKey]);
 useLayoutEffect(()=>{committedKey.current=measurementKey;refreshMeasurements();return()=>{++measureVersion.current;if(measureFrame.current!==null){cancelAnimationFrame(measureFrame.current);measureFrame.current=null;}};},[measurementKey,refreshMeasurements]);
 const overflow=content>(available||viewport)+1&&viewport>0,maxOffset=Math.max(0,content-viewport);
 const move=useCallback((x:number)=>{const next=clampNavigationOffset(x,viewport,content);offset.current=next;setPosition(next);scroll.current?.scrollTo({x:next,animated:false});},[viewport,content]);
 const reveal=useCallback((id:string)=>{const box=boxes.current.get(id);if(box&&viewport>0)move(revealNavigationOffset(offset.current,viewport,content,box));},[viewport,content,move]);
 useEffect(()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=requestAnimationFrame(()=>{frame.current=null;reveal(activeId)});return()=>{if(frame.current!==null)cancelAnimationFrame(frame.current)};},[activeId,width,fontScale,viewport,content,measured,reveal]);
 return <View style={s.nav} onLayout={e=>setAvailable(e.nativeEvent.layout.width)}>{overflow&&<Pressable accessibilityRole="button" accessibilityLabel="Show previous navigation tabs" accessibilityHint="Scrolls the navigation without changing your current page." disabled={position<=1} onPress={()=>move(pageNavigationOffset(offset.current,-1,viewport,content))} style={[s.scrollButton,position<=1&&s.unavailable]}><Text accessible={false} style={s.scrollGlyph}>‹</Text></Pressable>}<ScrollView ref={scroll} horizontal accessibilityRole="tablist" accessibilityLabel="Main navigation" showsHorizontalScrollIndicator={overflow} style={s.viewport} contentContainerStyle={s.navContent} onLayout={e=>setViewport(e.nativeEvent.layout.width)} onContentSizeChange={w=>{setNativeContent(w);refreshMeasurements();}} onScroll={e=>{offset.current=e.nativeEvent.contentOffset.x;setPosition(offset.current)}} scrollEventThrottle={16}>{items.map(item=><Pressable key={item.id} ref={node=>{if(node)tabRefs.current.set(item.id,node);else tabRefs.current.delete(item.id);}} accessibilityRole="tab" accessibilityLabel={item.label} aria-selected={activeId===item.id} accessibilityState={{selected:activeId===item.id}} onFocus={()=>reveal(item.id)} onPress={()=>onNavigate(item.id)} onLayout={()=>refreshMeasurements()} style={[s.navItem,{maxWidth:viewport>0?Math.max(44,viewport-16):undefined},activeId===item.id&&s.navSelected]}><Text accessible={false} style={[s.navIcon,activeId===item.id&&s.navActive]}>{item.icon}</Text><Text style={[s.navLabel,activeId===item.id&&s.navActive]}>{item.label}</Text></Pressable>)}</ScrollView>{overflow&&<Pressable accessibilityRole="button" accessibilityLabel="Show more navigation tabs" accessibilityHint="Scrolls the navigation without changing your current page." disabled={position>=maxOffset-1} onPress={()=>move(pageNavigationOffset(offset.current,1,viewport,content))} style={[s.scrollButton,position>=maxOffset-1&&s.unavailable]}><Text accessible={false} style={s.scrollGlyph}>›</Text></Pressable>}</View>;
}
const s=StyleSheet.create({
 header:{paddingHorizontal:22,paddingVertical:12,gap:4,backgroundColor:C.white,borderBottomColor:C.line,borderBottomWidth:1},headerRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',columnGap:16,rowGap:4},brandButton:{minHeight:44,justifyContent:'center',flexShrink:0},brandLockup:{flexDirection:'row',alignItems:'center',gap:9,minHeight:48},brandEmblem:{width:34,height:48},wordmark:{fontSize:23,letterSpacing:-.5,fontWeight:'800',color:C.navy},headerTag:{fontSize:9,fontWeight:'700',letterSpacing:1.5,lineHeight:15,color:C.muted,flex:1},fullTag:{flex:0,alignSelf:'stretch'},account:{minHeight:44,justifyContent:'center',maxWidth:'100%'},accountText:{color:C.blue,fontWeight:'700',fontSize:13},
 nav:{flexDirection:'row',alignItems:'stretch',backgroundColor:C.white,borderTopWidth:1,borderTopColor:C.line,paddingTop:8,paddingBottom:Platform.OS==='android'?22:8},viewport:{flex:1},navContent:{flexGrow:1,alignItems:'stretch',paddingHorizontal:8},navItem:{flexGrow:1,flexShrink:0,minWidth:64,minHeight:58,paddingHorizontal:10,paddingVertical:6,alignItems:'center',justifyContent:'center',gap:4,borderRadius:12},navSelected:{backgroundColor:C.sky},navIcon:{fontSize:24,color:C.muted},navLabel:{fontSize:11,fontWeight:'600',color:C.muted,textAlign:'center',alignSelf:'stretch',flexShrink:1},navActive:{color:C.blue},scrollButton:{width:44,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:C.sky,borderRadius:12},scrollGlyph:{fontSize:22,color:C.blue},unavailable:{opacity:.4},
});
