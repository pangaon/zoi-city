import { StatusBar } from 'expo-status-bar';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

const WEB = 'https://www.zoi.city';

type Tab = 'home' | 'discover' | 'business' | 'tickets' | 'more';

const ROUTES = {
  discover: '/explore',
  map: '/explore/map',
  business: '/social',
  tickets: '/tickets',
  intelligence: '/apps/intelligence/',
  command: '/apps/command-center/',
  community: '/community',
};

function openRoute(path: string) {
  Linking.openURL(path.startsWith('http') ? path : WEB + path);
}

function ActionButton({ label, path, primary = false }: { label: string; path: string; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" style={[styles.action, primary && styles.actionPrimary]} onPress={() => openRoute(path)}>
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function ProductCard({ eyebrow, title, body, path, action }: { eyebrow: string; title: string; body: string; path: string; action: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <ActionButton label={action} path={path} />
    </View>
  );
}

function Home() {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.seal}><Text style={styles.sealText}>Ζ</Text></View>
        <Text style={styles.kicker}>THE GREEK WORLD, CONNECTED</Text>
        <Text style={styles.heroTitle}>Find your people. Build what matters.</Text>
        <Text style={styles.heroBody}>One mobile door into the Zoi directory, community, business tools, tickets, and intelligence.</Text>
        <View style={styles.row}><ActionButton label="Explore the directory" path={ROUTES.discover} primary /><ActionButton label="Open the map" path={ROUTES.map} /></View>
      </View>
      <Text style={styles.sectionTitle}>Start here</Text>
      <ProductCard eyebrow="DISCOVER" title="The Greek directory" body="Search real businesses, churches, professionals, events, and places across the diaspora." path={ROUTES.discover} action="Search places" />
      <ProductCard eyebrow="COMMUNITY" title="The agora" body="See what the community is sharing, tag real places, and keep the conversation connected to the directory." path={ROUTES.community} action="Open Community" />
      <Text style={styles.sectionTitle}>For your work</Text>
      <ProductCard eyebrow="BUSINESS" title="Your daily business desk" body="Plan content, use templates, manage your audience, publish to Zoi Community, and connect external networks when ready." path={ROUTES.business} action="Open Business" />
      <ProductCard eyebrow="EVENTS" title="Tickets that actually check in" body="Create events, share a ticket link, issue QR confirmations, and run Door mode." path={ROUTES.tickets} action="Open Tickets" />
      <ProductCard eyebrow="INTELLIGENCE" title="Understand what to fix next" body="Scan a public website, see real evidence, and move from a problem to the right Zoi tool." path={ROUTES.intelligence} action="Run a website check" />
    </ScrollView>
  );
}

function Discover() { return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Discover</Text><Text style={styles.pageBody}>Choose the way you want to find a place.</Text><ProductCard eyebrow="DIRECTORY" title="Search listings" body="Use the canonical Zoi directory with real search and filters." path={ROUTES.discover} action="Search the directory" /><ProductCard eyebrow="MAP" title="See places geographically" body="Open the live map with clickable listings, clusters, and coordinate precision." path={ROUTES.map} action="Open the map" /></ScrollView>; }
function Business() { return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Business</Text><Text style={styles.pageBody}>Your mobile doorway into the Zoi Business Suite.</Text><ProductCard eyebrow="PLAN" title="Calendar and queue" body="See what is planned and what needs attention." path={ROUTES.business} action="Open your suite" /><ProductCard eyebrow="CREATE" title="Composer and templates" body="Start from a real template, tailor the copy, add your brand hashtags, and review previews." path={ROUTES.business} action="Compose a post" /><ProductCard eyebrow="GROW" title="Performance and audience" body="Review publishing activity and manage the people you are building relationships with." path={ROUTES.business} action="Open analytics" /></ScrollView>; }
function Tickets() { return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>Tickets</Text><Text style={styles.pageBody}>A durable event flow for organizers and guests.</Text><ProductCard eyebrow="ORGANIZE" title="Create and run an event" body="Create an event, add free ticket tiers, share the public page, manage attendees, and check people in." path={ROUTES.tickets} action="Open live Tickets" /><ProductCard eyebrow="GUEST" title="Reserve a place" body="Open a published event, reserve a free ticket, save the QR code, and use it at the door." path={ROUTES.tickets} action="Find events" /></ScrollView>; }
function More() { return <ScrollView contentContainerStyle={styles.content}><Text style={styles.pageTitle}>More</Text><Text style={styles.pageBody}>Founder and ecosystem tools.</Text><ProductCard eyebrow="FOUNDER" title="Command Center" body="Monitor listings, enrichment, ingestion, crawl failures, claims, and review work." path={ROUTES.command} action="Open Command Center" /><ProductCard eyebrow="BUY GREEK" title="The marketplace" body="BuyGreek is the future commerce layer for Greek products, services, and event demand." path="https://buygreek.shop" action="Visit BuyGreek" /></ScrollView>; }

export default function App() {
  const [tab, setTab] = useState<Tab>('home');
  const screens = { home: <Home />, discover: <Discover />, business: <Business />, tickets: <Tickets />, more: <More /> };
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.topbar}><Text style={styles.brand}>Zoi</Text><Text style={styles.topbarHint}>the Greek world</Text></View>
      <View style={styles.screen}>{screens[tab]}</View>
      <View style={styles.nav} accessibilityRole="tablist">
        {([['home', 'Home'], ['discover', 'Discover'], ['business', 'Business'], ['tickets', 'Tickets'], ['more', 'More']] as [Tab, string][]).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} style={styles.navItem} onPress={() => setTab(key)}>
            <Text style={[styles.navIcon, tab === key && styles.navActive]}>{({ home: '⌂', discover: '⌕', business: '✦', tickets: '◇', more: '•••' } as Record<Tab, string>)[key]}</Text>
            <Text style={[styles.navLabel, tab === key && styles.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07111f',
  },
  topbar: { height: 58, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1b3148' },
  brand: { color: '#f2f5fa', fontSize: 23, fontWeight: '800' },
  topbarHint: { color: '#87a0ba', fontSize: 12, marginLeft: 9 },
  screen: { flex: 1 },
  content: { padding: 22, paddingBottom: 36 },
  hero: { paddingVertical: 18, marginBottom: 14 },
  seal: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#d4af5f', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  sealText: { color: '#142238', fontSize: 29, fontWeight: '800' },
  kicker: { color: '#d4af5f', fontSize: 11, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  heroTitle: { color: '#f2f5fa', fontSize: 35, lineHeight: 40, fontWeight: '800', marginBottom: 12 },
  heroBody: { color: '#9bb0c7', fontSize: 16, lineHeight: 24, marginBottom: 20 },
  pageTitle: { color: '#f2f5fa', fontSize: 30, fontWeight: '800', marginBottom: 8 },
  pageBody: { color: '#9bb0c7', fontSize: 15, lineHeight: 22, marginBottom: 20 },
  sectionTitle: { color: '#f2f5fa', fontSize: 21, fontWeight: '800', marginTop: 16, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 16, padding: 17, marginBottom: 12 },
  eyebrow: { color: '#d4af5f', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  cardTitle: { color: '#f2f5fa', fontSize: 20, fontWeight: '800', marginBottom: 7 },
  cardBody: { color: '#9bb0c7', fontSize: 14, lineHeight: 21, marginBottom: 14 },
  action: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#34526e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actionPrimary: { backgroundColor: '#4f9be8', borderColor: '#4f9be8' },
  actionText: { color: '#dce8f5', fontWeight: '700', fontSize: 13 },
  actionTextPrimary: { color: '#06101f' },
  nav: { height: 76, paddingHorizontal: 7, borderTopWidth: 1, borderTopColor: '#1b3148', backgroundColor: '#091827', flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 58 },
  navIcon: { color: '#718aa5', fontSize: 22, lineHeight: 26 },
  navLabel: { color: '#718aa5', fontSize: 11, fontWeight: '700', marginTop: 2 },
  navActive: { color: '#d4af5f' },
});
