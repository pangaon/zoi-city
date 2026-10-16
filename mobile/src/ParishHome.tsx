import { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, useColorScheme, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaleText as Text } from './ScaleText';
import { estimatePhotoHeroHeight } from './profileHeroLayout';

/** Values passed here have already been resolved from the public listing contract. */
export type ParishHomeProfile = {
  id: string;
  name: string;
  description?: string;
  location?: string;
  address?: string;
  website?: string;
  phone?: string;
  phoneHref?: string | null;
  email?: string;
  photo?: string;
  logo?: string;
};

/** A listing action is enabled only when its canonical listing id matches the profile. */
export type ParishListingAction = {
  listingId: string;
  /** Destination UUID for linked tools such as a volunteer workspace. */
  targetId?: string;
  run: (listingId: string) => void;
};

export type ParishHomeProps = {
  profile: ParishHomeProfile;
  onBack?: () => void;
  actions?: {
    calendar?: ParishListingAction;
    groups?: ParishListingAction;
    volunteer?: ParishListingAction;
  };
  /** Only pass colors from the published owner design. Invalid colors use accessible defaults. */
  publishedColors?: {
    accent?: string;
    background?: string;
    surface?: string;
    foreground?: string;
    muted?: string;
    border?: string;
  };
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const safeText = (value?: string) => typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
const safeImage = (value?: string) => safeHttps(value) ? value : '';
function safeHttps(value?: string) {
  if (typeof value !== 'string' || value.length > 2048 || /[\x00-\x20\\]/.test(value)) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; } catch { return false; }
}
const color = (value: string | undefined, fallback: string) => value && HEX.test(value) ? value : fallback;
function luminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}
function colorsFor(dark: boolean, published?: ParishHomeProps['publishedColors']) {
  const defaults = dark
    ? { accent: '#B6A86A', background: '#101915', surface: '#19241E', foreground: '#F5F2E8', muted: '#C3C9BE', border: '#37443B' }
    : { accent: '#626C43', background: '#F7F5EF', surface: '#FFFFFF', foreground: '#17251E', muted: '#59645B', border: '#DADFD5' };
  return Object.fromEntries(Object.keys(defaults).map(key => [key, color((published as any)?.[key], (defaults as any)[key])])) as typeof defaults;
}
const actionFor = (action: ParishListingAction | undefined, listingId: string) =>
  action && UUID.test(listingId) && action.listingId?.toLowerCase() === listingId.toLowerCase() && (!action.targetId || UUID.test(action.targetId)) && typeof action.run === 'function' ? action : null;

export function ParishHome({ profile, actions, publishedColors, onBack }: ParishHomeProps) {
  const dark = useColorScheme() === 'dark';
  const { width, fontScale } = useWindowDimensions();
  const palette = useMemo(() => colorsFor(dark, publishedColors), [dark, publishedColors]);
  const styles = useMemo(() => makeStyles(palette, width), [palette, width]);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const photo = safeImage(profile.photo);
  const logo = safeImage(profile.logo);
  const name = safeText(profile.name);
  const description = safeText(profile.description);
  const location = safeText(profile.location);
  const address = safeText(profile.address);
  const phone = safeText(profile.phone);
  const phoneHref = phone && typeof profile.phoneHref === 'string' && /^tel:[+0-9().;=-]{3,64}$/i.test(profile.phoneHref) ? profile.phoneHref : '';
  const email = typeof profile.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email) ? profile.email : '';
  const website = safeHttps(profile.website) ? profile.website : '';
  const calendar = actionFor(actions?.calendar, profile.id);
  const groups = actionFor(actions?.groups, profile.id);
  const volunteer = actionFor(actions?.volunteer, profile.id);
  const ctaBackground = contrast(palette.accent, '#FFFFFF') >= 4.5 ? palette.accent
    : contrast(palette.foreground, '#FFFFFF') >= 4.5 ? palette.foreground : '#17251E';
  const ctaText = contrast(ctaBackground, '#FFFFFF') >= 4.5 ? '#FFFFFF' : '#17251E';
  const basePhotoHeroHeight = Math.min(360, Math.max(218, width * .72));
  const photoHeroHeight = estimatePhotoHeroHeight({ width, baseHeight: basePhotoHeroHeight, fontScale, title: name, titleFontSize: width < 360 ? 24 : 26, titleLineHeight: (width < 360 ? 24 : 26) * 1.12, supportingText: location ? [{ text: location, fontSize: 14, lineHeight: 21 }] : [], horizontalPadding: 22, verticalPadding: 44 });

  useEffect(() => { setPhotoFailed(false); }, [photo]);
  useEffect(() => { setLogoFailed(false); }, [logo]);

  const open = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  const sectionAction = (label: string, hint: string, action: ParishListingAction | null) => action ? (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={() => action.run(action.targetId || profile.id)}
      style={({ pressed }: any) => [styles.actionRow, pressed && styles.pressed]}
    >
      <View style={styles.actionCopy}><Text style={styles.actionTitle}>{label}</Text></View>
      <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.chevron}>›</Text>
    </Pressable>
  ) : null;

  return (
    <ScrollView testID="parish-home" style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : <View style={styles.backSpacer} />}
        <View style={styles.brand}>
          {logo && !logoFailed ? <Image source={{ uri: logo }} resizeMode="contain" accessibilityLabel={name + ' logo'} onError={() => setLogoFailed(true)} style={styles.logo} /> : <View accessible={false} style={styles.logoFallback}><Text style={styles.logoLetter}>{name.slice(0, 1).toLocaleUpperCase()}</Text></View>}
        </View>
        <View style={styles.backSpacer} />
      </View>

      <View style={[styles.hero, (photo && !photoFailed) ? { height: photoHeroHeight } : styles.noPhoto]}>
        {photo && !photoFailed ? <Image source={{ uri: photo }} resizeMode="cover" accessible={false} onError={() => setPhotoFailed(true)} style={styles.heroImage} /> : null}
        {photo && !photoFailed ? <LinearGradient colors={photoHeroHeight > basePhotoHeroHeight ? ['rgba(11,20,15,0.60)', 'rgba(11,20,15,0.74)', 'rgba(11,20,15,0.90)'] : ['rgba(11,20,15,0.02)', 'rgba(11,20,15,0.58)', 'rgba(11,20,15,0.90)']} locations={photoHeroHeight > basePhotoHeroHeight ? [0, .50, 1] : [0, .52, 1]} style={StyleSheet.absoluteFill} /> : null}
        <View style={[styles.heroCopy, !(photo && !photoFailed) && styles.heroCopyFallback]}>
          {location ? <Text style={[styles.location, photo && !photoFailed && styles.locationOnImage]}>{location}</Text> : null}
          <Text accessibilityRole="header" style={[styles.name, photo && !photoFailed ? styles.nameOnImage : styles.nameFallback]}>{name}</Text>
        </View>
      </View>

      {description ? <View style={styles.descriptionBlock}><Text numberOfLines={3} style={styles.description}>{description}</Text></View> : null}

      {website || phoneHref || email || address ? <View style={styles.contactCard}>
        {address ? <Text selectable style={styles.address}>{address}</Text> : null}
        <View style={styles.contactActions}>
          {website ? <Pressable accessibilityRole="link" accessibilityLabel="Open parish website" onPress={() => open(website)} style={[styles.contactButton, { backgroundColor: ctaBackground }]}><Text style={[styles.contactButtonText, { color: ctaText }]}>Website</Text></Pressable> : null}
          {phoneHref ? <Pressable accessibilityRole="link" accessibilityLabel="Call parish" onPress={() => open(phoneHref)} style={styles.contactButtonSecondary}><Text style={styles.contactButtonSecondaryText}>Call</Text></Pressable> : null}
          {email ? <Pressable accessibilityRole="link" accessibilityLabel="Email parish" onPress={() => open('mailto:' + encodeURIComponent(email))} style={styles.contactButtonSecondary}><Text style={styles.contactButtonSecondaryText}>Email</Text></Pressable> : null}
        </View>
      </View> : null}

      {calendar || groups || volunteer ? <View accessibilityRole="list" style={styles.actionsBlock}>
        {sectionAction('Calendar', 'Open this parish’s published calendar', calendar)}
        {sectionAction('Groups', 'Explore groups for this parish', groups)}
        {sectionAction('Volunteer', 'Open volunteer opportunities for this parish', volunteer)}
      </View> : null}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

function makeStyles(palette: ReturnType<typeof colorsFor>, width: number) {
  const titleSize = width < 360 ? 24 : 26;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.background },
    content: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 32, gap: 16 },
    topBar: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    back: { width: 48, height: 48, alignItems: 'flex-start', justifyContent: 'center' },
    backText: { color: palette.foreground, fontSize: 34, lineHeight: 40 },
    backSpacer: { width: 48, height: 48 },
    brand: { minWidth: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
    logo: { width: 42, height: 42 },
    logoFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
    logoLetter: { color: palette.accent, fontFamily: 'Georgia', fontSize: 19 },
    hero: { minHeight: 0, overflow: 'hidden', borderRadius: 24, backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1, justifyContent: 'flex-end' },
    noPhoto: { minHeight: 70, justifyContent: 'center' },
    heroImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
    heroCopy: { paddingHorizontal: 22, paddingBottom: 22, gap: 7 },
    heroCopyFallback: { flex: 0, minHeight: 70, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
    location: { color: palette.muted, fontSize: 14, lineHeight: 21, letterSpacing: .3 },
    locationOnImage: { color: '#F5F2E8' },
    name: { color: palette.foreground, fontFamily: 'Georgia', fontSize: titleSize, lineHeight: titleSize * 1.12, fontWeight: '500', flexShrink: 1 },
    nameFallback: { fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' }), fontSize: 21, lineHeight: 26, fontWeight: '600' },
    nameOnImage: { color: '#FFFFFF' },
    descriptionBlock: { paddingHorizontal: 3, paddingVertical: 2 },
    description: { color: palette.muted, fontSize: 14, lineHeight: 21 },
    contactCard: { borderRadius: 18, padding: 16, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, gap: 12 },
    address: { color: palette.foreground, fontSize: 14, lineHeight: 21 },
    contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    contactButton: { minHeight: 48, minWidth: 92, paddingHorizontal: 18, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    contactButtonText: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
    contactButtonSecondary: { minHeight: 48, minWidth: 88, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.background, borderWidth: 1, borderColor: palette.border },
    contactButtonSecondaryText: { color: palette.foreground, fontSize: 15, lineHeight: 22, fontWeight: '600' },
    actionsBlock: { gap: 8, paddingTop: 2 },
    actionRow: { minHeight: 54, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: 15 },
    actionCopy: { flex: 1, paddingRight: 12 },
    actionTitle: { color: palette.foreground, fontSize: 15, lineHeight: 22, fontWeight: '600' },
    chevron: { color: palette.accent, fontSize: 26, lineHeight: 30 },
    pressed: { opacity: .72 },
    bottomSpace: { height: 8 },
  });
}
