import {forwardRef, type ComponentRef} from 'react';
import {Platform, Text as NativeText, type TextProps, useWindowDimensions} from 'react-native';

// Refresh the native paragraph after a system font change without replacing
// its owning screen, inputs, map or application state. Scaling stays with RN.
export const ScaleText = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function ScaleText(props, ref) {
    const {fontScale} = useWindowDimensions();
    return <NativeText {...props} ref={ref} key={Platform.OS === 'web' ? 'web' : fontScale}/>;
  },
);
