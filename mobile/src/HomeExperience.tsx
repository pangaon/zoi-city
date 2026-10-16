import { type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaleText as Text } from './ScaleText';
import { DARK, LIGHT } from './brand';
import { Icon } from './Icon';

type Destination = 'discover' | 'community' | 'tickets' | 'grow';
const routes = [
  { id: 'community', title: 'Community', body: 'People, nearby.' },
  { id: 'tickets', title: 'Events', body: 'What’s on.' },
  { id: 'discover', title: 'Discover', body: 'Places and services.' },
  { id: 'grow', title: 'For business', body: 'Your business tools.' },
] as const;

export function HomeExperience({ navigate, onMap, onShop, children }: { navigate: (destination: Destination) => void; onMap: () => void; onShop: () => void; children: ReactNode }) {
  const dark = useColorScheme() === 'dark', palette = dark ? DARK : LIGHT;
  const { width, fontScale } = useWindowDimensions(), columns = width >= 650 && fontScale < 1.4;
  const surface = dark ? '#10243b' : '#ffffff', line = dark ? '#33455a' : '#d9e0e8';
  return <View style={s.flow}>
    <View style={s.hero}>
      <Image source={require('../assets/aegean-opening-v2.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} accessible={false} />
      <LinearGradient colors={['rgba(3,22,43,0.02)', 'rgba(3,22,43,0.25)', 'rgba(3,22,43,0.96)']} locations={[0, .3, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.heroContent}>
        <View style={s.heroReading}>
          <Text accessibilityRole="header" style={s.heroTitle}>Your people.{ '\n' }Your possibilities.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Discover places and people" onPress={() => navigate('discover')} style={({ pressed }) => [s.search, pressed && s.pressed]}>
            <Icon name="search" size={20} color="#153658" /><Text style={s.searchText}>Places, people, services</Text><Icon name="arrow" size={20} color="#153658" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore the map" onPress={onMap} style={({ pressed }) => [s.mapLink, pressed && s.pressed]}><Icon name="map" size={18} color="#ffffff" /><Text style={s.mapLinkText}>Explore the map</Text><Icon name="arrow" size={18} color="#ffffff" /></Pressable>
        </View>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Shop BuyGreek marketplace" onPress={onShop} style={({ pressed }) => [s.market, { backgroundColor: surface, borderColor: line }, pressed && s.pressed]}>
      <View style={s.marketCopy}><Text style={[s.eyebrow, { color: palette.muted }]}>BUY GREEK</Text><Text style={[s.marketTitle, { color: palette.ink }]}>BuyGreek</Text></View><View style={s.marketArrow}><Icon name="arrow" color="#ffffff" size={23} /></View>
    </Pressable>
    <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle, { color: palette.ink }]}>Explore</Text></View>
    <View style={s.routes}>{routes.map(route => <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={route.title} onPress={() => navigate(route.id)} style={({ pressed }) => [s.route, { flexBasis: columns ? '47%' : '100%', borderColor: line }, pressed && s.pressed]}>
      <View style={s.routeCopy}><Text style={[s.routeTitle, { color: palette.ink }]}>{route.title}</Text><Text style={[s.routeBody, { color: palette.muted }]}>{route.body}</Text></View><Icon name="arrow" color={palette.accent} size={19} />
    </Pressable>)}</View>
    {children}
  </View>;
}

const s = StyleSheet.create({
  flow: { gap: 18 },
  eyebrow: { fontSize: 9, lineHeight: 14, letterSpacing: 1.2, fontWeight: '700' },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#133b60' },
  heroContent: { padding: 18, minHeight: 330, justifyContent: 'flex-end', gap: 22 },
  heroReading: { gap: 9 }, heroTitle: { color: '#ffffff', fontFamily: 'Georgia', fontSize: 31, lineHeight: 34, letterSpacing: -.6, fontWeight: '400' },
  search: { backgroundColor: '#ffffff', borderRadius: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { color: '#153658', fontSize: 13, lineHeight: 18, fontWeight: '600', flex: 1, flexShrink: 1 },
  mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, paddingVertical: 7 },
  mapLinkText: { color: '#ffffff', fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  market: { padding: 16, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }, marketCopy: { flex: 1, gap: 3 },
  marketTitle: { fontFamily: 'Georgia', fontSize: 23, lineHeight: 28, letterSpacing: -.35, fontWeight: '400' },
  marketArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#075dcc' },
  sectionHeading: { paddingHorizontal: 3 }, sectionTitle: { fontFamily: 'Georgia', fontSize: 21, lineHeight: 26, letterSpacing: -.25, fontWeight: '400' },
  routes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  route: { flexGrow: 1, borderTopWidth: 1, paddingVertical: 12, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  routeCopy: { flex: 1, gap: 2 },
  routeTitle: { fontSize: 17, lineHeight: 22, letterSpacing: -.2, fontWeight: '600' }, routeBody: { fontSize: 12, lineHeight: 18 }, pressed: { opacity: .76 },
});
