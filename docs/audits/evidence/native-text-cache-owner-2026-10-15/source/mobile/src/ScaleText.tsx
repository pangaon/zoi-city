import {forwardRef, type ComponentRef} from 'react';
import {Platform, Text as NativeText, type TextProps, useWindowDimensions} from 'react-native';

// Android's global measurement cache ignores host identity. Bind its existing
// native font field to system scale as well as refreshing the text host. The
// pinned postinstall patch exposes that field; Android still paints using SP.
export const ScaleText = forwardRef<ComponentRef<typeof NativeText>, TextProps>(
  function ScaleText(props, ref) {
    const {fontScale} = useWindowDimensions();
    const nativeProps = Platform.OS === 'android' ? {...props, fontSizeMultiplier: fontScale} : props;
    return <NativeText {...nativeProps} ref={ref} key={Platform.OS === 'web' ? 'web' : fontScale}/>;
  },
);
