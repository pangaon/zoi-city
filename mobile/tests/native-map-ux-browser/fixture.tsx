// @ts-nocheck -- controlled browser boundary exports supplied by build.cjs.
import {useEffect,useState} from 'react';import{createRoot}from'react-dom/client';import{View,Text,ScaleContext}from'react-native';
import{Discover}from'../../src/Discovery';import{AppHeader,PrimaryNavigation}from'../../src/AppChrome';import{initialDiscovery}from'../../src/discovery';
import{ActorContext}from'../../src/Auth';import source from'../food-menu-browser/public-home-entity.json';
// Existing retained anonymous151 source. Point literal matches retained public
// geography_reviewed_point SHA313675c9... (2026-10-15); controlled transport only.
const point={"latitude":42.426359,"longitude":-83.374051,"precision":"street","listing_id":"373f6d89-03b6-4c58-b293-93a805885f5b","request_id":"bec77e09-460d-47e7-9f77-8752f7d6ae59"};
const w=window as any;w.nativeLinks=[];w.nativeGPS=0;w.nativeRequests=[];w.nativeMode='current';w.nativeFail='';w.nativePending=[];
// Retained current point receipt is replayed as an explicit controlled transport;
// this never claims a fresh production source review or coordinate correction.
w.nativeRead=async(name:string,args:any)=>{w.nativeRequests.push({name,args});const mode=w.nativeMode;
 if(w.nativeFail===name)throw Error('controlled_read_unavailable');
 if(name==='explore_cities'||name==='explore_geo')return [];
 if(name==='explore_search')return [];
 if(name==='home_entity'){
  if(mode==='delay')return new Promise(resolve=>w.nativePending.push({resolve,slug:args.p_slug}));
  const e=structuredClone(source);e.slug=args.p_slug;e.canonical_slug=args.p_slug;e.photo_url=null;
  if(mode==='greek')e.name='Ελληνικό Αρτοποιείο και Παραδοσιακά Προϊόντα της Κοινότητας';
  if(mode==='unmapped'){e.latitude=null;e.longitude=null;e.geo_precision=null;}
  if(mode==='approx'){e.geo_precision='city';e.latitude=42.4;e.longitude=-83.4;}
  if(mode==='sparse'){e.latitude=null;e.longitude=null;e.geo_precision=null;e.address=null;e.city=null;e.country=null;e.name='Sparse place';}
  return e;
 }
 if(name==='geography_reviewed_point')return mode==='current'||mode==='greek'?point:null;
 throw Error('unexpected_controlled_reader:'+name);
};
function Fixture(){const[state,setState]=useState({...initialDiscovery(),mode:'map' as const,source:'global' as const,selected:source.slug}),[scale,setScale]=useState(1),[expanded,setExpanded]=useState(false),[actor,setActor]=useState<string|null>(null),[route,setRoute]=useState('discover');
 w.nativeFixture=(o:any)=>{if(o.scale!==undefined)setScale(o.scale);if(o.mode){w.nativeMode=o.mode;setState({...initialDiscovery(),mode:'map',source:'global',selected:source.slug+'-'+o.mode});}if(o.intent)setState(s=>({...s,selected:o.intent}));if(o.fail!==undefined)w.nativeFail=o.fail;if(o.actor!==undefined){setActor(o.actor);setExpanded(false);}if(o.route){setRoute(o.route);setExpanded(false);}if(o.list){setExpanded(false);setState({...initialDiscovery(),mode:'list',source:'global'});}};
 useEffect(()=>{w.nativeState=state;w.nativeExpanded=expanded;},[state,expanded]);
 return <ActorContext.Provider value={actor}><ScaleContext.Provider value={scale}><View style={{height:'100vh',width:'100%',maxWidth:780,alignSelf:'center',backgroundColor:'#F7FAFC'}}>{!expanded?<AppHeader onHome={()=>{setExpanded(false);setRoute('home')}} onAccount={()=>{setExpanded(false);setRoute('grow')}}/>:null}{route==='discover'?<Discover key={actor||'guest'} state={state} setState={setState} open={p=>w.nativeLinks.push(p)} signIn={()=>w.nativeLinks.push('sign-in')} expanded={expanded} onExpandedChange={setExpanded}/>:<View><Text>{route}</Text></View>}{!expanded?<PrimaryNavigation activeId={route} onNavigate={v=>{setExpanded(false);setRoute(v)}}/>:null}</View></ScaleContext.Provider></ActorContext.Provider>;
}createRoot(document.getElementById('root')!).render(<Fixture/>);
