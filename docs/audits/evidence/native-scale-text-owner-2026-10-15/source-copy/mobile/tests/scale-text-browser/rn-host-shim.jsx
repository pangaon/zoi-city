// Controlled native host boundary; actual React reconciliation and RN-web Text.
// This is not an Android text-cache emulator or an installed acceptance claim.
import {createContext, forwardRef, useContext, useEffect} from 'react';
import * as Web from 'react-native-web';
export * from 'react-native-web';
export const FontScaleContext = createContext(1);
export const Platform = {...Web.Platform, OS: new URLSearchParams(location.search).get('platform') || 'android'};
export function useWindowDimensions() {
  return {...Web.useWindowDimensions(), fontScale: useContext(FontScaleContext)};
}
export const Text = forwardRef(function NativeTextHost(props, ref) {
  const scale = useContext(FontScaleContext), style = Web.StyleSheet.flatten(props.style) || {};
  useEffect(() => {
    window.hostEvents.push({event: 'mount', testID: props.testID});
    return () => window.hostEvents.push({event: 'unmount', testID: props.testID});
  }, []);
  window.lastHostProps[props.testID] = props;
  return <Web.Text {...props} ref={ref} style={[props.style, {
    fontSize: (style.fontSize || 14) * (props.allowFontScaling === false ? 1 : scale),
  }]}/>;
});
