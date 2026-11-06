import { useEffect, useMemo, useState } from 'react';
import { ScaleText as Text } from './ScaleText';
import { ActivityIndicator, Image, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { commerceProduct, displayCommercePrice } from './commerce';

export type RetailerProfile = {
  id: string;
  name: string;
  /** Exact Shopify vendor value, verified against the retailer's canonical store record. */
  seller?: string;
  location?: string;
  description?: string;
  photo?: string;
  logo?: string;
  website?: string;
};
export type RetailerAppearance = {
  background: string;
  ink: string;
  muted: string;
  accent: string;
  primaryColor: string;
  surface: string;
  line: string;
};
export type RetailerCatalogue = {
  status: 'loading' | 'ready' | 'error';
  /** Public catalog origin; only the BuyGreek Shopify catalog is currently supported. */
  source?: string;
  /** Must match profile.seller, which is resolved from the canonical retailer record. */
  seller?: string;
  products?: unknown[];
  message?: string;
};
type Props = {
  profile: RetailerProfile;
  appearance: RetailerAppearance;
  catalogue: RetailerCatalogue;
  back: () => void;
  retry: () => void;
  onProduct: (handle: string, variant?: string) => void;
};

/** Rejects unbound, malformed, duplicated, or cross-seller catalogue rows. */
export function retailerProducts(input: RetailerCatalogue, seller: string) {
  if (input.status !== 'ready' || input.source !== 'buygreek.shop' || !seller || input.seller !== seller || !Array.isArray(input.products) || input.products.length > 120) {
    throw new Error('This retailer catalogue could not be verified.');
  }
  const rows = input.products.map((value) => commerceProduct(value));
  if (rows.some((product: any) => product.vendor !== seller) || new Set(rows.map((product: any) => product.id)).size !== rows.length) {
    throw new Error('This retailer catalogue could not be verified.');
  }
  return rows;
}

function safeImage(value?: string) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
function safeWebsite(value?: string) {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}

function ProductImage({ uri, label, style, fallback }: { uri: string | null; label: string; style: any; fallback: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed) return <View accessible accessibilityLabel={uri ? 'Product image unavailable' : 'No product image supplied'} style={[style, { backgroundColor: fallback }]} />;
  return <Image source={{ uri }} accessibilityLabel={label} resizeMode="cover" onError={() => setFailed(true)} style={style as any} />;
}

export function RetailerHome({ profile, appearance, catalogue, back, retry, onProduct }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [linkError, setLinkError] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const styles = useMemo(() => makeStyles(appearance), [appearance]);
  const seller = (profile.seller || '').trim();
  const website = safeWebsite(profile.website);
  const hero = safeImage(profile.photo);
  let catalogueProblem = '';
  let products: any[] = [];
  if (catalogue.status === 'ready' && !seller) catalogueProblem = 'A retailer-to-catalogue match is not available yet.';
  else if (catalogue.status === 'ready') {
    try { products = retailerProducts(catalogue, seller); }
    catch { catalogueProblem = 'The product list could not be matched to this retailer.'; }
  }
  const categories = [...new Set(products.map((product) => String(product.type || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const term = search.trim().toLocaleLowerCase();
  const visible = products.filter((product) => (!category || product.type === category) && (!term || `${product.title} ${product.description} ${product.type}`.toLocaleLowerCase().includes(term)));
  // Keep the product photography spacious when system text is enlarged.
  const columns = width / Math.max(1, fontScale) >= 360;
  const openWebsite = () => { if (website) void Linking.openURL(website).then(() => setLinkError('')).catch(() => setLinkError('Website could not be opened.')); };
  const enterProduct = (product: any) => setSelected(product);
  const closeProduct = () => setSelected(null);
  const purchaseHandoff = (product: any, variant?: string) => { closeProduct(); onProduct(product.handle, variant); };
  const action = (label: string, onPress: () => void, primary = false, disabled = false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, primary && styles.primary, disabled && styles.disabled, pressed && styles.pressed]}><Text style={[styles.actionText, primary && styles.primaryText]}>{label}</Text></Pressable>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        <View style={styles.identity}>
        {profile.logo && safeImage(profile.logo) && !logoFailed ? <Image source={{ uri: safeImage(profile.logo) }} accessibilityLabel={profile.name + ' logo'} resizeMode="contain" onError={() => setLogoFailed(true)} style={styles.logo} /> : null}
          <View style={styles.nameBlock}><Text numberOfLines={2} accessibilityRole="header" style={styles.name}>{profile.name}</Text>{profile.location ? <Text numberOfLines={1} style={styles.location}>{profile.location}</Text> : null}</View>
        </View>
        {website ? <Pressable accessibilityRole="link" accessibilityLabel="Visit retailer website" onPress={openWebsite} style={styles.website}><Text style={styles.websiteText}>Website ↗</Text></Pressable> : null}
      </View>

      {linkError ? <Text accessibilityRole="alert" style={styles.error}>{linkError}</Text> : null}
      {hero ? <ProductImage uri={hero} label={profile.name + ' photograph'} style={styles.hero} fallback={appearance.surface} /> : null}
      {profile.description ? <Text style={styles.description}>{profile.description}</Text> : null}

      {selected ? <View style={styles.detail}>
        {action('Back to products', closeProduct)}
        <ProductImage uri={selected.image} label={selected.image_alt || selected.title} style={styles.detailImage} fallback={appearance.surface} />
        <Text accessibilityRole="header" style={styles.detailTitle}>{selected.title}</Text>
        {selected.description ? <Text style={styles.description}>{selected.description}</Text> : null}
        <Text accessibilityRole="header" style={styles.sectionTitle}>Options</Text>
        {selected.variants.map((variant: any) => <Pressable key={variant.id} accessibilityRole="button" accessibilityLabel={`${variant.title === 'Default Title' && selected.variants.length === 1 ? 'Product option' : variant.title}, ${displayCommercePrice(variant.price, variant.currency)}${variant.available ? ', continue to BuyGreek' : ', unavailable'}`} accessibilityState={{ disabled: !variant.available }} disabled={!variant.available} onPress={() => purchaseHandoff(selected, variant.id)} style={[styles.variant, !variant.available && styles.variantUnavailable]}>
          <View style={styles.variantText}><Text style={styles.variantName}>{variant.title === 'Default Title' && selected.variants.length === 1 ? 'Product option' : variant.title}</Text>{variant.options?.length ? <Text style={styles.muted}>{variant.options.map((option: any) => `${option.name}: ${option.value}`).join(' · ')}</Text> : null}</View>
          <Text style={styles.price}>{displayCommercePrice(variant.price, variant.currency)}</Text>
          {!variant.available ? <Text style={styles.muted}>Unavailable</Text> : null}
          {variant.available ? <Text style={styles.handoff}>BuyGreek ↗</Text> : null}
        </Pressable>)}
        <Text style={styles.note}>Stock and checkout are confirmed on BuyGreek.</Text>
      </View> : <>
        <View style={styles.catalogueHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Products</Text><Text style={styles.muted}>{catalogue.status === 'ready' && !catalogueProblem ? visible.length + (visible.length === 1 ? ' item' : ' items') : ''}</Text></View>
        <TextInput accessibilityLabel="Search this catalogue" placeholder="Search products" value={search} onChangeText={setSearch} maxLength={120} returnKeyType="search" style={styles.search} />
        {categories.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityLabel="Product categories">
          {['', ...categories].map((value) => <Pressable key={value || 'all'} accessibilityRole="button" accessibilityState={{ selected: category === value }} onPress={() => setCategory(value)} style={[styles.filter, category === value && styles.filterSelected]}><Text style={[styles.filterText, category === value && styles.filterTextSelected]}>{value || 'All'}</Text></Pressable>)}
        </ScrollView> : null}
        {catalogue.status === 'loading' ? <View accessibilityLiveRegion="polite" style={styles.state}><ActivityIndicator accessibilityLabel="Loading products" color={appearance.accent} /><Text style={styles.muted}>Loading products…</Text></View> : null}
        {catalogueProblem ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{catalogueProblem}</Text></View> : null}
        {catalogue.status === 'error' ? <View style={styles.state}><Text accessibilityRole="alert" style={styles.error}>{catalogue.message || 'Products could not be loaded.'}</Text>{action('Retry products', retry, true)}</View> : null}
        {catalogue.status === 'ready' && !catalogueProblem && visible.length === 0 ? <Text style={styles.empty}>{products.length ? 'No products match this search.' : 'No products are listed for this retailer yet.'}</Text> : null}
        {catalogue.status === 'ready' && !catalogueProblem ? <View style={styles.grid}>{visible.map((product) => <Pressable key={product.id} accessibilityRole="button" accessibilityLabel={'View ' + product.title} onPress={() => enterProduct(product)} style={[styles.product, { width: columns ? '48%' : '100%' }]}>
          <ProductImage uri={product.image} label={product.image_alt || product.title} style={styles.productImage} fallback={appearance.surface} />
          <Text numberOfLines={2} style={styles.productTitle}>{product.title}</Text>
          <Text style={styles.price}>{product.price_min ? displayCommercePrice(product.price_min.price, product.price_min.currency) : 'See options'}</Text>
          {!product.available ? <Text style={styles.muted}>Unavailable</Text> : null}
        </Pressable>)}</View> : null}
        <Text style={styles.note}>Checkout on BuyGreek.</Text>
      </>}
    </ScrollView>
  </SafeAreaView>;
}

function makeStyles(d: RetailerAppearance) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: d.background }, screen: { flex: 1, backgroundColor: d.background }, content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30, gap: 14 },
    top: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }, back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: d.surface, borderWidth: 1, borderColor: d.line }, backText: { color: d.ink, fontSize: 24, lineHeight: 28 },
    identity: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: 10 }, logo: { width: 42, height: 42, borderRadius: 10, backgroundColor: d.surface }, nameBlock: { flex: 1, gap: 2 }, name: { color: d.ink, fontSize: 17, lineHeight: 22, fontWeight: '700' }, location: { color: d.muted, fontSize: 12, lineHeight: 17 }, website: { minHeight: 44, paddingHorizontal: 12, borderRadius: 22, justifyContent: 'center', borderWidth: 1, borderColor: d.line, backgroundColor: d.surface }, websiteText: { color: d.accent, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    hero: { width: '100%', height: 170, borderRadius: 18, backgroundColor: d.surface }, description: { color: d.muted, fontSize: 14, lineHeight: 21 }, catalogueHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 4 }, sectionTitle: { color: d.ink, fontSize: 19, lineHeight: 25, fontWeight: '600' }, muted: { color: d.muted, fontSize: 12, lineHeight: 18 },
    search: { minHeight: 48, borderWidth: 1, borderColor: d.line, borderRadius: 24, backgroundColor: d.surface, paddingHorizontal: 16, color: d.ink, fontSize: 15 }, filters: { gap: 8, paddingVertical: 2 }, filter: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, justifyContent: 'center', borderWidth: 1, borderColor: d.line, backgroundColor: d.surface }, filterSelected: { backgroundColor: d.primaryColor, borderColor: d.primaryColor }, filterText: { color: d.ink, fontSize: 13, lineHeight: 18 }, filterTextSelected: { color: '#FFFFFF', fontWeight: '700' },
    state: { minHeight: 110, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: d.surface }, error: { color: d.ink, fontSize: 14, lineHeight: 20, textAlign: 'center' }, empty: { paddingVertical: 22, color: d.muted, fontSize: 14, lineHeight: 21 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }, product: { borderRadius: 16, overflow: 'hidden', backgroundColor: d.surface, borderWidth: 1, borderColor: d.line, paddingBottom: 10 }, productImage: { width: '100%', height: 150, backgroundColor: d.background }, productTitle: { marginTop: 8, marginHorizontal: 10, color: d.ink, fontSize: 14, lineHeight: 19, fontWeight: '600' }, price: { marginHorizontal: 10, marginTop: 4, color: d.ink, fontSize: 13, lineHeight: 18, fontWeight: '600' }, note: { color: d.muted, fontSize: 11, lineHeight: 17 },
    detail: { gap: 12 }, detailImage: { width: '100%', height: 250, borderRadius: 18, backgroundColor: d.surface }, detailTitle: { color: d.ink, fontSize: 20, lineHeight: 26, fontWeight: '700' }, variant: { minHeight: 54, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, backgroundColor: d.surface, borderWidth: 1, borderColor: d.line, borderRadius: 14 }, variantUnavailable: { opacity: 0.55 }, variantText: { flex: 1, minWidth: 130, gap: 2 }, variantName: { color: d.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' }, handoff: { color: d.accent, fontSize: 12, lineHeight: 18, fontWeight: '700' },
    action: { minHeight: 44, minWidth: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: d.line, backgroundColor: d.surface }, primary: { backgroundColor: d.primaryColor, borderColor: d.primaryColor }, actionText: { color: d.accent, fontSize: 14, lineHeight: 20, fontWeight: '600' }, primaryText: { color: '#FFFFFF' }, disabled: { opacity: 0.48 }, pressed: { opacity: 0.82 },
  });
}
