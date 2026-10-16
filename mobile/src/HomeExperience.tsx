import { type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaleText as Text } from './ScaleText';
import { DARK, LIGHT } from './brand';
import { Icon } from './Icon';

type Destination = 'discover' | 'community' | 'tickets' | 'grow';
const routes = [
  { id: 'community', title: 'Community', body: 'People and local activity.' },
  { id: 'tickets', title: 'Events', body: 'Discover events and tickets.' },
  { id: 'discover', title: 'Discover', body: 'Places, food and services.' },
  { id: 'grow', title: 'For business', body: 'Tools for your work.' },
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
          <Text style={s.heroBody}>Discover, connect and build your world.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Discover places and people" onPress={() => navigate('discover')} style={({ pressed }) => [s.search, pressed && s.pressed]}>
            <Icon name="search" size={20} color="#153658" /><Text style={s.searchText}>Discover places and people</Text><Icon name="arrow" size={20} color="#153658" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore the map" onPress={onMap} style={({ pressed }) => [s.mapLink, pressed && s.pressed]}><Icon name="map" size={18} color="#ffffff" /><Text style={s.mapLinkText}>Explore the map</Text><Icon name="arrow" size={18} color="#ffffff" /></Pressable>
        </View>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Shop BuyGreek marketplace" onPress={onShop} style={({ pressed }) => [s.market, { backgroundColor: surface, borderColor: line }, pressed && s.pressed]}>
      <View style={s.marketCopy}><Text style={[s.eyebrow, { color: palette.muted }]}>MARKETPLACE</Text><Text style={[s.marketTitle, { color: palette.ink }]}>BuyGreek</Text><Text style={[s.routeBody, { color: palette.muted }]}>Shop Greek goods.</Text></View><View style={s.marketArrow}><Icon name="arrow" color="#ffffff" size={23} /></View>
    </Pressable>
    <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle, { color: palette.ink }]}>Explore Zoi</Text></View>
    <View style={s.routes}>{routes.map((route, index) => <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={route.title} onPress={() => navigate(route.id)} style={({ pressed }) => [s.route, { flexBasis: columns ? '47%' : '100%', borderColor: line }, pressed && s.pressed]}>
      <Text accessible={false} style={[s.routeNumber, { color: palette.accent }]}>0{index + 1}</Text><View style={s.routeCopy}><Text style={[s.routeTitle, { color: palette.ink }]}>{route.title}</Text><Text style={[s.routeBody, { color: palette.muted }]}>{route.body}</Text></View><Icon name="arrow" color={palette.accent} size={19} />
    </Pressable>)}</View>
    {children}
  </View>;
}

const s = StyleSheet.create({
  flow: { gap: 18 },
  eyebrow: { fontSize: 9, lineHeight: 14, letterSpacing: 1.2, fontWeight: '700' },
  hero: { borderRadius: 22, overflow: 'hidden', backgroundColor: '#133b60' },
  heroContent: { padding: 18, minHeight: 380, justifyContent: 'flex-end', gap: 28 },
  heroReading: { gap: 10 }, heroTitle: { color: '#ffffff', fontSize: 32, lineHeight: 38, letterSpacing: -.7, fontWeight: '600' },
  heroBody: { color: '#f1f5fa', fontSize: 14, lineHeight: 20, maxWidth: 440 },
  search: { backgroundColor: '#ffffff', borderRadius: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { color: '#153658', fontSize: 13, lineHeight: 18, fontWeight: '600', flex: 1, flexShrink: 1 },
  mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, paddingVertical: 7 },
  mapLinkText: { color: '#ffffff', fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  market: { padding: 16, borderRadius: 18, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }, marketCopy: { flex: 1, gap: 3 },
  marketTitle: { fontSize: 25, lineHeight: 30, letterSpacing: -.4, fontWeight: '600' },
  marketArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#075dcc' },
  sectionHeading: { paddingHorizontal: 3 }, sectionTitle: { fontSize: 21, lineHeight: 27, letterSpacing: -.25, fontWeight: '600' },
  routes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  route: { flexGrow: 1, borderTopWidth: 1, paddingVertical: 15, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  routeNumber: { fontSize: 9, lineHeight: 16, fontWeight: '700', letterSpacing: .8, alignSelf: 'flex-start', paddingTop: 4 }, routeCopy: { flex: 1, gap: 3 },
  routeTitle: { fontSize: 17, lineHeight: 22, letterSpacing: -.2, fontWeight: '600' }, routeBody: { fontSize: 12, lineHeight: 18 }, pressed: { opacity: .76 },
});
