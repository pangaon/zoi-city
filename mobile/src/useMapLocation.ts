import {useEffect,useRef,useState} from 'react';
import {AppState,Platform} from 'react-native';import * as Location from 'expo-location';
import {createForegroundLocation} from '../../assets/map-data/foreground-location.mjs';
export function useMapLocation(scope:string,onFix:(fix:any,options:{center:boolean})=>void){
 const [state,setState]=useState<any>({phase:'idle',fix:null,canAskAgain:true}),callback=useRef(onFix),controller=useRef<any>(null);callback.current=onFix;
 useEffect(()=>{
  let focused=true;
  // An explicit Android snapshot can use GPS when network location is unavailable.
  // The existing controller stops after one fix, cancellation or its20s deadline.
  const control=createForegroundLocation({getPermission:()=>Location.getForegroundPermissionsAsync(),requestPermission:()=>Location.requestForegroundPermissionsAsync(),servicesEnabled:()=>Location.hasServicesEnabledAsync(),watch:(success:any,error:any)=>{if(AppState.currentState!=='active'||!focused)throw Error('foreground_required');return Location.watchPositionAsync({accuracy:Platform.OS==='android'?Location.Accuracy.High:Location.Accuracy.Balanced,distanceInterval:0,timeInterval:1000,mayShowUserSettingsDialog:false},success,error);},onState:setState,onFix:(fix:any,options:any)=>callback.current(fix,options)});controller.current=control;
  const background=AppState.addEventListener('change',status=>{if(status==='background'||status==='inactive'&&control.getState().phase!=='permission')control.cancel();});
  // React Native AppState focus/blur events exist on Android only.
  const focus=Platform.OS==='android'?AppState.addEventListener('focus',()=>{focused=true;}):null;
  const blur=Platform.OS==='android'?AppState.addEventListener('blur',()=>{focused=false;if(control.getState().phase!=='permission')control.cancel();}):null;
  const visibility=()=>{if(typeof document!=='undefined'&&document.hidden)control.cancel();};if(typeof document!=='undefined')document.addEventListener('visibilitychange',visibility);
  return()=>{background.remove();blur?.remove();focus?.remove();if(typeof document!=='undefined')document.removeEventListener('visibilitychange',visibility);control.dispose();controller.current=null;};
 },[]);
 useEffect(()=>{controller.current?.manualMove();controller.current?.cancel();},[scope]);
 return{state,request:()=>controller.current?.request(),clear:()=>controller.current?.cancel(),manualMove:()=>controller.current?.manualMove()};
}
