// Controlled RN-web adapter for native point scaling. Production imports remain
// react-native; this fixture scales measured Text points once, as native does.
import{createContext,forwardRef,useContext}from'react';import*as Web from'react-native-web';
export*from'react-native-web';
export const FontScaleContext=createContext(1);
export const Text=forwardRef((props,ref)=>{const scale=useContext(FontScaleContext),style=Web.StyleSheet.flatten(props.style)||{};return <Web.Text {...props} ref={ref} style={[props.style,{fontSize:(style.fontSize||14)*scale,...(style.lineHeight?{lineHeight:style.lineHeight*scale}:{})}]}/>});
export function useWindowDimensions(){return{...Web.useWindowDimensions(),fontScale:useContext(FontScaleContext)}}
