/** Ephemeral foreground device fix. No persistence, geocoding or network calls. */
export function validatedDeviceFix(value,{now=Date.now(),requestedAt=now}={}){
 const c=value?.coords,t=value?.timestamp;
 if(!c||![c.latitude,c.longitude,t].every(v=>typeof v==='number'&&Number.isFinite(v))||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180||t>now+5000||t<now-60000||t<requestedAt-1000)return null;
 const accuracy=c.accuracy;if(accuracy!==null&&accuracy!==undefined&&(typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>20000000))return null;
 return{latitude:c.latitude,longitude:c.longitude,accuracy:accuracy??null,timestamp:t};
}
export function deviceLocationLabel(fix){if(!fix)return '';const a=fix.accuracy;return a===0?'Device location · reported accuracy 0 m':a===null?'Device location · accuracy unavailable':a>=1000?'Device location · about '+(a/1000).toFixed(a>=10000?0:1)+' km accuracy':'Device location · about '+Math.max(1,Math.round(a))+' m accuracy';}
export function deviceLocationRegion(fix){const delta=Math.min(110,Math.max(0.012,(fix.accuracy??1000)*6/111000));return{latitude:fix.latitude,longitude:fix.longitude,latitudeDelta:delta,longitudeDelta:Math.min(170,delta/Math.max(0.15,Math.cos(fix.latitude*Math.PI/180)))};}
/** @param {{getPermission?:any,requestPermission?:any,servicesEnabled?:any,watch?:any,onState?:any,onFix?:any,now?:any,setTimer?:any,clearTimer?:any,timeout?:number,retention?:number}} options */
export function createForegroundLocation({getPermission,requestPermission,servicesEnabled,watch,onState=()=>{},onFix=()=>{},now=Date.now,setTimer=setTimeout,clearTimer=clearTimeout,timeout=20000,retention=120000}={}){
 let generation=0,cameraEpoch=0,subscription=null,timer=null,expiry=null,disposed=false,state={phase:'idle',fix:null,canAskAgain:true};
 const emit=next=>{state={...state,...next};onState(state);};
 const stop=()=>{if(timer!==null)clearTimer(timer);timer=null;subscription?.remove();subscription=null;};
 function cancel({clear=true}={}){generation++;stop();if(expiry!==null)clearTimer(expiry);expiry=null;if(!disposed)emit({phase:'idle',...(clear?{fix:null}:{})});}
 function manualMove(){cameraEpoch++;}
 async function request(){
  if(disposed||['permission','locating'].includes(state.phase))return;
  cancel();const ticket=++generation,intent=cameraEpoch,requestedAt=now(),current=()=>!disposed&&ticket===generation;
  const fail=(phase,extra={})=>{if(!current())return;generation++;stop();emit({phase,...extra});};
  emit({phase:'permission'});timer=setTimer(()=>fail('timeout'),timeout);
  try{
   if(!await servicesEnabled()){fail('services_off');return;}if(!current())return;
   let permission=await getPermission();if(!current())return;
   if(permission?.status!=='granted'&&permission?.canAskAgain!==false)permission=await requestPermission();if(!current())return;
   if(permission?.status!=='granted'){fail('denied',{canAskAgain:permission?.canAskAgain!==false});return;}
   emit({phase:'locating',canAskAgain:true});
   const pending=await watch(value=>{
    if(!current())return;const fix=validatedDeviceFix(value,{now:now(),requestedAt});if(!fix)return;
    const completed=++generation;stop();emit({phase:'ready',fix});onFix(fix,{center:intent===cameraEpoch});
    if(disposed||generation!==completed)return;expiry=setTimer(()=>{expiry=null;if(!disposed)emit({phase:'expired',fix:null});},retention);
   },()=>fail('unavailable'));
   if(!current()){pending?.remove();return;}if(!pending||typeof pending.remove!=='function'){fail('unavailable');return;}subscription=pending;
  }catch{fail('unavailable');}
 }
 return{request,cancel,manualMove,getState:()=>state,dispose(){disposed=true;cancel();}};
}

export function deviceAccuracyFeature(fix){
 if(!fix||!(fix.accuracy>0))return{type:'FeatureCollection',features:[]};
 const rad=Math.PI/180,lat=fix.latitude*rad,lng=fix.longitude*rad,distance=fix.accuracy/6371008.8,coordinates=[];
 for(let i=0;i<=64;i++){const bearing=i/64*2*Math.PI,y=Math.asin(Math.sin(lat)*Math.cos(distance)+Math.cos(lat)*Math.sin(distance)*Math.cos(bearing)),x=lng+Math.atan2(Math.sin(bearing)*Math.sin(distance)*Math.cos(lat),Math.cos(distance)-Math.sin(lat)*Math.sin(y));coordinates.push([x/rad,y/rad]);}
 return{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[coordinates]}}]};
}
