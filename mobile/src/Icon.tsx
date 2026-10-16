import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName = 'home' | 'discover' | 'community' | 'tickets' | 'grow' | 'search' | 'map' | 'arrow' | 'more' | 'account' | 'close' | 'expand' | 'shop';

/** One consistent, resolution-independent navigation set. Labels live on controls. */
export function Icon({ name, size = 22, color = 'currentColor' }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS==='web'?{'aria-hidden':true}:{accessible:false})}>
    {name === 'home' && <><Path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>}
    {name === 'discover' && <><Circle cx={12} cy={12} r={9} /><Path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>}
    {name === 'community' && <><Circle cx={9} cy={8} r={3} /><Path d="M3 20v-2a6 6 0 0 1 12 0v2M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2" /></>}
    {name === 'tickets' && <><Rect x={3} y={5} width={18} height={16} rx={3} /><Path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" /></>}
    {name === 'grow' && <><Path d="M4 20V9m8 11v-6m8 6V4M4 4l6 6 10-8m-6 0h6v6" /></>}
    {name === 'shop' && <><Path d="M5 7h14l1 14H4Zm3 0V5a4 4 0 0 1 8 0v2" /></>}
    {name === 'search' && <><Circle cx={10.5} cy={10.5} r={6.5} /><Path d="m16 16 5 5" /></>}
    {name === 'map' && <><Path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16" /></>}
    {name === 'arrow' && <Path d="M4 12h15m-6-6 6 6-6 6" />}
    {name === 'more' && <><Circle cx={5} cy={12} r={1} /><Circle cx={12} cy={12} r={1} /><Circle cx={19} cy={12} r={1} /></>}
    {name === 'account' && <><Circle cx={12} cy={8} r={3} /><Path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>}
    {name === 'close' && <Path d="m6 6 12 12M6 18 18 6" />}
    {name === 'expand' && <Path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6" />}
  </Svg>;
}
