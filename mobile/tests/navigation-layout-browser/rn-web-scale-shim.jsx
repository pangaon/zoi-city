// Controlled RN-web adapter for native point scaling. Production imports remain
// react-native; this fixture scales measured Text points once, as native does.
import{createContext,forwardRef,useContext,useImperativeHandle,useRef}from'react';import*as Web from'react-native-web';
export*from'react-native-web';
export const FontScaleContext=createContext(1);
export const Text=forwardRef((props,ref)=>{const scale=useContext(FontScaleContext),style=Web.StyleSheet.flatten(props.style)||{};return <Web.Text {...props} ref={ref} style={[props.style,{fontSize:(style.fontSize||14)*scale,...(style.lineHeight?{lineHeight:style.lineHeight*scale}:{})}]}/>});
export function useWindowDimensions(){return{...Web.useWindowDimensions(),fontScale:useContext(FontScaleContext)}}

// Test-only controls model the installed hot-font failure: no native content
// size callback, and optionally late measurements from an older layout pass.
export const SuppressContentSizeContext=createContext(false);
export const ScrollView=forwardRef((props,ref)=>{const suppress=useContext(SuppressContentSizeContext);return <Web.ScrollView {...props} ref={ref} onContentSizeChange={suppress?undefined:props.onContentSizeChange}/>});
export const Pressable=forwardRef((props,ref)=>{const node=useRef(null),suppress=useContext(SuppressContentSizeContext);useImperativeHandle(ref,()=>({measureLayout:(parent,success,failure)=>node.current?.measureLayout(parent,(...values)=>{if(window.navigationMeasurementHold){(window.navigationPendingMeasurements||=[]).push(()=>success(...values));}else success(...values)},failure)}),[]);return <Web.Pressable {...props} ref={node} onLayout={suppress&&props.accessibilityRole==='tab'?undefined:props.onLayout}/>});
window.releaseNavigationMeasurements=()=>{const pending=window.navigationPendingMeasurements||[];window.navigationPendingMeasurements=[];pending.forEach(fn=>fn());return pending.length;};
