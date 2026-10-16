import { type ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaleText as Text } from './ScaleText';
import { DARK, LIGHT } from './brand';
import { Icon } from './Icon';

type Destination = 'discover' | 'community' | 'tickets' | 'grow';
const routes = [
  { id: 'community', title: 'Find your people', body: 'Stories, conversations and community.' },
  { id: 'tickets', title: 'Be there', body: 'Explore events that bring us together.' },
  { id: 'discover', title: 'Discover more', body: 'Find places, people and possibilities.' },
  { id: 'grow', title: 'Bring your ideas', body: 'A home for what you are building.' },
] as const;

export function HomeExperience({ navigate, onMap, onShop, children }: { navigate: (destination: Destination) => void; onMap: () => void; onShop: () => void; children: ReactNode }) {
  const dark = useColorScheme() === 'dark', palette = dark ? DARK : LIGHT;
  const { width, fontScale } = useWindowDimensions(), columns = width >= 650 && fontScale < 1.4;
  const surface = dark ? '#10243b' : '#ffffff', line = dark ? '#33455a' : '#d9e0e8';
  return <View style={s.flow}>
    <View style={s.introduction}>
      <Text style={[s.eyebrow, { color: palette.accent }]}>GREEK ROOTS. GLOBAL LIFE.</Text>
      <Text accessibilityRole="header" style={[s.greeting, { color: palette.ink }]}>A world closer to home.</Text>
      <Text style={[s.introBody, { color: palette.muted }]}>Your places. Your people. Your Zoi.</Text>
    </View>
    <View style={s.hero}>
      <Image source={require('../assets/aegean-opening-v2.png')} resizeMode="cover" style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} accessible={false} />
      <LinearGradient colors={['rgba(3,22,43,0.02)', 'rgba(3,22,43,0.25)', 'rgba(3,22,43,0.96)']} locations={[0, .3, 1]} style={StyleSheet.absoluteFill} />
      <View style={s.heroContent}>
        <View style={s.heroTop}><Text style={s.photoCaption}>AEGEAN INSPIRATION</Text><Text style={s.lifeText}>ζωή · life</Text></View>
        <View style={s.heroReading}>
          <Text accessibilityRole="header" style={s.heroTitle}>A little Greece.{ '\n' }Everywhere.</Text>
          <Text style={s.heroBody}>Discover the connections that bring your Greek world closer.</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Find your Greek connection" onPress={() => navigate('discover')} style={({ pressed }) => [s.search, pressed && s.pressed]}>
            <Icon name="search" size={20} color="#153658" /><Text style={s.searchText}>Find your Greek connection</Text><Icon name="arrow" size={20} color="#153658" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Explore the map" onPress={onMap} style={({ pressed }) => [s.mapLink, pressed && s.pressed]}><Icon name="map" size={18} color="#ffffff" /><Text style={s.mapLinkText}>Explore the map</Text><Icon name="arrow" size={18} color="#ffffff" /></Pressable>
        </View>
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Shop BuyGreek marketplace" onPress={onShop} style={({ pressed }) => [s.market, { backgroundColor: surface, borderColor: line }, pressed && s.pressed]}>
      <View style={s.marketCopy}><Text style={[s.eyebrow, { color: palette.muted }]}>THE MARKETPLACE</Text><Text style={[s.marketTitle, { color: palette.ink }]}>BuyGreek</Text><Text style={[s.routeBody, { color: palette.muted }]}>A little closer to home.</Text></View><View style={s.marketArrow}><Icon name="arrow" color="#ffffff" size={23} /></View>
    </Pressable>
    <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle, { color: palette.ink }]}>Your next connection.</Text><Text style={[s.sectionHint, { color: palette.muted }]}>Start with what matters to you.</Text></View>
    <View style={s.routes}>{routes.map((route, index) => <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={route.title} onPress={() => navigate(route.id)} style={({ pressed }) => [s.route, { flexBasis: columns ? '47%' : '100%', borderColor: line }, pressed && s.pressed]}>
      <Text accessible={false} style={[s.routeNumber, { color: palette.accent }]}>0{index + 1}</Text><View style={s.routeCopy}><Text style={[s.routeTitle, { color: palette.ink }]}>{route.title}</Text><Text style={[s.routeBody, { color: palette.muted }]}>{route.body}</Text></View><Icon name="arrow" color={palette.accent} size={19} />
    </Pressable>)}</View>
    {children}
  </View>;
}

const display = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });
const s = StyleSheet.create({
  flow: { gap: 24 }, introduction: { gap: 9, paddingHorizontal: 3, paddingTop: 5 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.7, fontWeight: '700' },
  greeting: { fontFamily: display, fontSize: 38, lineHeight: 44, letterSpacing: -1.2, fontWeight: '400', maxWidth: 600 },
  introBody: { fontSize: 14, lineHeight: 22 },
  hero: { borderRadius: 25, overflow: 'hidden', backgroundColor: '#133b60' },
  heroContent: { padding: 22, minHeight: 430, justifyContent: 'space-between', gap: 105 },
  heroTop: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  photoCaption: { color: '#ffffff', fontSize: 9, lineHeight: 16, letterSpacing: 1.8, fontWeight: '700', textShadowColor: '#153658', textShadowRadius: 5 },
  lifeText: { color: '#ffffff', fontSize: 12, lineHeight: 16, fontFamily: display, textShadowColor: '#153658', textShadowRadius: 5 },
  heroReading: { gap: 15 }, heroTitle: { color: '#ffffff', fontFamily: display, fontSize: 39, lineHeight: 44, letterSpacing: -.8, fontWeight: '400' },
  heroBody: { color: '#f1f5fa', fontSize: 14, lineHeight: 22, maxWidth: 440 },
  search: { backgroundColor: '#ffffff', borderRadius: 14, minHeight: 52, paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchText: { color: '#153658', fontSize: 13, lineHeight: 20, fontWeight: '600', flex: 1, flexShrink: 1 },
  mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, paddingVertical: 7 },
  mapLinkText: { color: '#ffffff', fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  market: { padding: 21, borderRadius: 20, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 18 }, marketCopy: { flex: 1, gap: 5 },
  marketTitle: { fontFamily: display, fontSize: 29, lineHeight: 35, letterSpacing: -.7 },
  marketArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#075dcc' },
  sectionHeading: { gap: 6, paddingHorizontal: 3 }, sectionTitle: { fontFamily: display, fontSize: 28, lineHeight: 35, letterSpacing: -.7 }, sectionHint: { fontSize: 13, lineHeight: 20 },
  routes: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 24 },
  route: { flexGrow: 1, borderTopWidth: 1, paddingVertical: 20, paddingHorizontal: 3, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 90 },
  routeNumber: { fontSize: 10, lineHeight: 18, fontWeight: '700', letterSpacing: 1, alignSelf: 'flex-start', paddingTop: 4 }, routeCopy: { flex: 1, gap: 5 },
  routeTitle: { fontFamily: display, fontSize: 23, lineHeight: 29, letterSpacing: -.4 }, routeBody: { fontSize: 13, lineHeight: 20 }, pressed: { opacity: .76 },
});
