import { useEffect, useId, useRef } from 'react';
import { Animated, AppState, Platform, StyleSheet } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { usePresentationPreferences } from './Presentation';

/** Decorative vector water: no stock client imagery, video download or moving text. */
export function AegeanArt({ animated = false }: { animated?: boolean }) {
  const id = useId().replace(/:/g, ''), progress = useRef(new Animated.Value(0)).current;
  const { motion } = usePresentationPreferences();
  useEffect(() => {
    if (!animated || !motion) { progress.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: 6500, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(progress, { toValue: 0, duration: 6500, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    const update = (state: string) => { if (state === 'active') animation.start(); else animation.stop(); };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); animation.stop(); progress.setValue(0); };
  }, [animated, motion, progress]);
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[s.art, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 12] }) }] }]}>
    <Svg width="100%" height="100%" viewBox="0 0 400 480" preserveAspectRatio="xMidYMid slice" {...(Platform.OS === 'web' ? { 'aria-hidden': true } : { accessible: false })}>
      <Defs><LinearGradient id={id} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#7ef3e7" stopOpacity={0.02} /><Stop offset="1" stopColor="#b8f9ff" stopOpacity={0.45} /></LinearGradient></Defs>
      {[0, 1, 2, 3, 4, 5, 6].map(i => <Path key={i} d={`M-90 ${300 + i * 18} C70 ${140 + i * 18} 185 ${440 + i * 17} 480 ${210 + i * 24}`} stroke={`url(#${id})`} strokeWidth={1} fill="none" />)}
      <Path d="M330-50C180 20 420 110 300 180S220 270 430 340" stroke="#b7f8ff" strokeOpacity={0.14} strokeWidth={60} fill="none" />
    </Svg>
  </Animated.View>;
}
const s = StyleSheet.create({ art: { position: 'absolute', top: 0, right: -15, bottom: 0, left: -15, opacity: 0.9 } });
