import { type ReactNode } from 'react';
import { Pressable, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AegeanArt } from './AegeanArt';
import { ScaleText as Text } from './ScaleText';
import { DARK, LIGHT } from './brand';
import { Icon } from './Icon';
import { GlassHero } from './Presentation';

type Destination = 'discover' | 'community' | 'tickets' | 'grow';
export function HomeExperience({ navigate, onMap, onShop, children }: { navigate: (destination: Destination) => void; onMap: () => void; onShop: () => void; children: ReactNode }) {
  const dark = useColorScheme() === 'dark', palette = dark ? DARK : LIGHT;
  const { width, fontScale } = useWindowDimensions(), wideCards = width >= 370 && fontScale < 1.4;
  return <View style={s.flow}>
    <View style={s.introduction}><Text style={[s.welcome, { color: palette.muted }]}>A little closer to home</Text><Text style={[s.greeting, { color: palette.ink }]}>Your Greek world.</Text></View>
    <GlassHero variant="aegean">
      <AegeanArt />
      <View style={s.heroContent}>
        <View style={s.heroTop}><View style={s.lifeBadge}><Text style={s.lifeText}>ζωή · life</Text></View><Icon name="discover" color="#a8e9f4" size={25} /></View>
        <Text accessibilityRole="header" style={[s.heroTitle,fontScale>1.4&&{fontSize:34,lineHeight:39}]}>Greece, in{ '\n' }your hand.</Text>
        <Text style={s.heroBody}>The places, people and moments that bring us together. Wherever you call home.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Find your Greek connection" onPress={() => navigate('discover')} style={({ pressed }) => [s.search, pressed && s.pressed]}>
          <Icon name="search" size={21} color="#155375" /><Text style={s.searchText}>Find your Greek connection</Text><Icon name="arrow" size={20} color="#155375" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Explore the map" onPress={onMap} style={({ pressed }) => [s.mapLink, pressed && s.pressed]}><Icon name="map" size={18} color="#c7f2fa" /><Text style={s.mapLinkText}>Explore the map</Text><Icon name="arrow" size={17} color="#c7f2fa" /></Pressable>
      </View>
    </GlassHero>
    <Pressable accessibilityRole="button" accessibilityLabel="Shop BuyGreek marketplace" onPress={onShop} style={({pressed})=>[s.market,{backgroundColor:dark?'#183b45':'#edf8f5',borderColor:dark?'#355766':'#ffffff'},pressed&&s.pressed]}><View style={s.marketIcon}><Icon name="shop" color={dark?'#c2eee3':'#286e66'} size={25}/></View><View style={{flex:1,gap:4}}><Text style={[s.routeTitle,{color:palette.ink}]}>BuyGreek</Text><Text style={[s.routeBody,{color:palette.muted}]}>The marketplace. A little closer to home.</Text></View><Icon name="arrow" color={palette.accent} size={20}/></Pressable>
    <View style={s.sectionHeading}><Text accessibilityRole="header" style={[s.sectionTitle, { color: palette.ink }]}>Make it your Zoi</Text><Text style={[s.sectionHint, { color: palette.muted }]}>Start with what matters to you.</Text></View>
    <View style={s.routes}>
      {([
        { id: 'community', title: 'Find your people', body: 'Stories. Conversations. Community.', icon: 'community', colors: dark ? ['#143949', '#102943'] : ['#e7f9f6', '#f5fffd'], ink: dark ? '#a2eee0' : '#17665f' },
        { id: 'tickets', title: 'Be there', body: 'Events worth coming together for.', icon: 'tickets', colors: dark ? ['#193354', '#102943'] : ['#e9f1ff', '#f8faff'], ink: dark ? '#b0d4ff' : '#2052a1' },
        { id: 'discover', title: 'Discover more', body: 'Your next favourite place.', icon: 'discover', colors: dark ? ['#16364b', '#102943'] : ['#e6f5fc', '#f4fbff'], ink: dark ? '#b0e2ff' : '#20617d' },
        { id: 'grow', title: 'Bring your ideas', body: 'A home for what you are building.', icon: 'grow', colors: dark ? ['#30304a', '#102943'] : ['#f0edff', '#faf9ff'], ink: dark ? '#d6c8ff' : '#63538a' },
      ] as const).map(route => <Pressable key={route.id} accessibilityRole="button" accessibilityLabel={route.title} onPress={() => navigate(route.id)} style={({ pressed }) => [s.route, { flexBasis: wideCards ? '47%' : '100%', borderColor: dark ? '#32516a' : '#ffffff' }, pressed && s.pressed]}>
        <LinearGradient colors={[route.colors[0],route.colors[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={s.routeTop}><View style={[s.routeIcon, { backgroundColor: dark ? '#ffffff0d' : '#ffffffad' }]}><Icon name={route.icon} color={route.ink} size={22} /></View><Icon name="arrow" color={route.ink} size={17} /></View>
        <Text style={[s.routeTitle, { color: palette.ink }]}>{route.title}</Text><Text style={[s.routeBody, { color: palette.muted }]}>{route.body}</Text>
      </Pressable>)}
    </View>
    {children}
  </View>;
}

const s = StyleSheet.create({
  flow: { gap: 22 }, introduction: { gap: 5, paddingHorizontal: 3 }, welcome: { fontSize: 13, lineHeight: 20 }, greeting: { fontSize: 29, lineHeight: 35, letterSpacing: -0.9, fontWeight: '700' },
 heroContent: { padding: 23, gap: 19 }, heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  lifeBadge: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#ffffff12', borderWidth: 1, borderColor: '#d1faff40' }, lifeText: { color: '#dbfaff', fontSize: 12, letterSpacing: 1, fontWeight: '600' },
  heroTitle: { color: '#ffffff', fontSize: 44, lineHeight: 47, letterSpacing: -1.9, fontWeight: '700' }, heroBody: { color: '#d0e9f1', fontSize: 15, lineHeight: 23, maxWidth: 440 },
  search: { backgroundColor: '#f4fdff', borderRadius: 18, borderWidth: 1, borderColor: '#ffffff', minHeight: 56, paddingHorizontal: 15, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0 8px 20px rgba(1,26,48,0.16)' }, searchText: { color: '#17445e', fontSize: 14, lineHeight: 20, fontWeight: '600', flex: 1, flexShrink: 1 },
  mapLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 44, paddingVertical: 7 }, mapLinkText: { color: '#dcf7ff', fontSize: 13, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  market:{padding:17,borderRadius:23,borderWidth:1,flexDirection:'row',alignItems:'center',gap:14},marketIcon:{width:46,height:46,alignItems:'center',justifyContent:'center',borderRadius:17,backgroundColor:'#ffffff22'},
  sectionHeading: { gap: 5, paddingHorizontal: 3 }, sectionTitle: { fontSize: 21, lineHeight: 28, letterSpacing: -0.5, fontWeight: '700' }, sectionHint: { fontSize: 13, lineHeight: 20 }, routes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  route: { flexGrow: 1, borderRadius: 23, borderWidth: 1, overflow: 'hidden', padding: 17, gap: 8 }, routeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }, routeIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, routeTitle: { fontSize: 16, lineHeight: 21, letterSpacing: -0.3, fontWeight: '700' }, routeBody: { fontSize: 12, lineHeight: 19 }, pressed: { opacity: 0.78 },
});
