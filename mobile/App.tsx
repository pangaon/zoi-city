import { StatusBar } from 'expo-status-bar';
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useState } from 'react';

const WEB = 'https://www.zoi.city';

type MainTab = 'home' | 'table' | 'private' | 'kds' | 'business' | 'tickets' | 'more';
type SplitMode = 'equal' | 'items' | 'custom' | 'cover';
type Station = 'all' | 'kitchen' | 'bar' | 'host';
type PrivateSubTab = 'rsvp' | 'seating' | 'registry' | 'photos' | 'itinerary';
type MealChoice = 'lamb' | 'sea_bass' | 'vegetarian' | 'kids';

interface TableMember {
  id: string;
  name: string;
  isHost?: boolean;
  avatar: string;
  itemsOrdered: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  category: 'food' | 'drink' | 'raffle' | 'gift';
  station: 'kitchen' | 'bar';
  orderedBy: string;
}

interface LiveOrderTicket {
  id: string;
  table: string;
  guestName: string;
  items: { name: string; qty: number; notes?: string }[];
  station: 'kitchen' | 'bar';
  total: number;
  status: 'received' | 'preparing' | 'ready' | 'delivered';
  paymentMethod: 'apple_pay' | 'card' | 'cash_pending' | 'cash_collected';
  time: string;
}

const MENU_ITEMS: Omit<OrderItem, 'id' | 'orderedBy'>[] = [
  { name: 'Grilled Mediterranean Octopus', price: 28, category: 'food', station: 'kitchen' },
  { name: 'Spanakopita Artisanal Platter', price: 18, category: 'food', station: 'kitchen' },
  { name: 'Assyrtiko Santorini White (Bottle)', price: 65, category: 'drink', station: 'bar' },
  { name: 'Greek Wine Xinomavro Naoussa (Bottle)', price: 72, category: 'drink', station: 'bar' },
  { name: 'Mastiha Digestif Round (4 shots)', price: 32, category: 'drink', station: 'bar' },
  { name: 'Panigiri Super Raffle Ticket (x5)', price: 25, category: 'raffle', station: 'bar' },
  { name: 'Nameday Table Gift: Honey Loukoumades', price: 22, category: 'gift', station: 'kitchen' },
];

function openRoute(path: string) {
  Linking.openURL(path.startsWith('http') ? path : WEB + path);
}

/* ─────────────────────────────────────────────────────────────
   GUEST TABLE & BILL SPLIT EXPERIENCE
   ───────────────────────────────────────────────────────────── */
function GuestTableView() {
  const [tableCode, setTableCode] = useState('VIP-4');
  const [guestName, setGuestName] = useState('George');
  const [joined, setJoined] = useState(true);
  const [splitMode, setSplitMode] = useState<SplitMode>('equal');
  const [members, setMembers] = useState<TableMember[]>([
    { id: '1', name: 'George (You)', isHost: true, avatar: 'Γ', itemsOrdered: 3 },
    { id: '2', name: 'Eleni K.', avatar: 'E', itemsOrdered: 2 },
    { id: '3', name: 'Nikos P.', avatar: 'N', itemsOrdered: 2 },
    { id: '4', name: 'Sofia M.', avatar: 'Σ', itemsOrdered: 1 },
  ]);
  const [tableOrders, setTableOrders] = useState<OrderItem[]>([
    { id: 'o1', name: 'Assyrtiko Santorini White (Bottle)', price: 65, category: 'drink', station: 'bar', orderedBy: 'George (You)' },
    { id: 'o2', name: 'Grilled Mediterranean Octopus', price: 28, category: 'food', station: 'kitchen', orderedBy: 'George (You)' },
    { id: 'o3', name: 'Spanakopita Artisanal Platter', price: 18, category: 'food', station: 'kitchen', orderedBy: 'Eleni K.' },
    { id: 'o4', name: 'Greek Wine Xinomavro Naoussa', price: 72, category: 'drink', station: 'bar', orderedBy: 'Nikos P.' },
    { id: 'o5', name: 'Panigiri Super Raffle Ticket (x5)', price: 25, category: 'raffle', station: 'bar', orderedBy: 'Sofia M.' },
  ]);
  const [crossTableGift, setCrossTableGift] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState<string | null>(null);

  const subtotal = tableOrders.reduce((sum, item) => sum + item.price, 0);
  const tax = Math.round(subtotal * 0.13);
  const tip = Math.round(subtotal * 0.18);
  const grandTotal = subtotal + tax + tip;
  const equalSplit = (grandTotal / Math.max(1, members.length)).toFixed(2);
  const myItemsTotal = tableOrders.filter(i => i.orderedBy.includes('You')).reduce((sum, i) => sum + i.price, 0);
  const myShare = Math.round(myItemsTotal * 1.31);

  const handleAddItem = (item: typeof MENU_ITEMS[0]) => {
    const newItem: OrderItem = {
      ...item,
      id: 'o_' + Date.now(),
      orderedBy: `${guestName} (You)`,
    };
    setTableOrders([...tableOrders, newItem]);
    Alert.alert('Item Added', `${item.name} added to Table ${tableCode} tab.`);
  };

  const handlePay = (method: 'apple' | 'card' | 'cash') => {
    if (method === 'cash') {
      setPaymentSuccess('Cash payment requested! Server has been dispatched to collect physical cash at Table ' + tableCode);
    } else {
      setPaymentSuccess(`Payment of $${splitMode === 'equal' ? equalSplit : myShare} processed via ${method === 'apple' ? 'Apple Pay' : 'Credit Card'}!`);
    }
  };

  const handleSendGift = () => {
    if (!crossTableGift) return;
    Alert.alert('Round Sent! 🥂', `Complimentary bottle of Greek Wine sent to Table ${crossTableGift}! They will receive an on-screen toast with your name.`);
    setCrossTableGift('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.tableHeaderBox}>
        <View style={styles.tableBadgeRow}>
          <View style={styles.liveDot} />
          <Text style={styles.tableBadgeText}>TABLE {tableCode} · SPONSORED BY KRINOS FOODS</Text>
        </View>
        <Text style={styles.tableTitle}>Hellenic Gala 2025 Table Tab</Text>
        <Text style={styles.tableSubtitle}>Orders placed by anyone at this table sync live in real-time.</Text>
      </View>

      {paymentSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>✓ {paymentSuccess}</Text>
          <Pressable onPress={() => setPaymentSuccess(null)} style={{ marginTop: 6 }}>
            <Text style={{ color: '#d4af5f', fontWeight: '700', fontSize: 12 }}>Dismiss</Text>
          </Pressable>
        </View>
      )}

      {/* WHO IS AT THE TABLE */}
      <Text style={styles.sectionTitle}>Seated at Table ({members.length})</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.memberScroll}>
        {members.map(m => (
          <View key={m.id} style={styles.memberPill}>
            <View style={styles.memberAvatar}><Text style={styles.memberAvatarText}>{m.avatar}</Text></View>
            <View>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberSub}>{m.isHost ? 'Host · ' : ''}{m.itemsOrdered} items</Text>
            </View>
          </View>
        ))}
        <Pressable style={styles.addMemberBtn} onPress={() => Alert.alert('Share Table QR', `Have your guest scan the Table ${tableCode} QR code or enter code "${tableCode}" in their Zoi app.`)}>
          <Text style={styles.addMemberText}>+ Invite</Text>
        </Pressable>
      </ScrollView>

      {/* ORDER MENU */}
      <Text style={styles.sectionTitle}>Order Food, Wine & Raffle</Text>
      <View style={styles.menuGrid}>
        {MENU_ITEMS.map((item, idx) => (
          <View key={idx} style={styles.menuCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuName}>{item.name}</Text>
              <Text style={styles.menuCat}>{item.category.toUpperCase()} · TO {item.station.toUpperCase()}</Text>
            </View>
            <Text style={styles.menuPrice}>${item.price}</Text>
            <Pressable style={styles.menuAddBtn} onPress={() => handleAddItem(item)}>
              <Text style={styles.menuAddText}>+ Add</Text>
            </Pressable>
          </View>
        ))}
      </View>

      {/* CROSS TABLE ROUND GIFTING */}
      <View style={styles.giftCard}>
        <Text style={styles.giftTitle}>🥂 Buy Another Table a Round</Text>
        <Text style={styles.giftBody}>Send drinks or dessert to friends celebrating across the room.</Text>
        <View style={styles.giftRow}>
          <TextInput
            placeholder="e.g. Table 8"
            placeholderTextColor="#64748f"
            style={styles.giftInput}
            value={crossTableGift}
            onChangeText={setCrossTableGift}
          />
          <Pressable style={styles.giftBtn} onPress={handleSendGift}>
            <Text style={styles.giftBtnText}>Send Round ($32)</Text>
          </Pressable>
        </View>
      </View>

      {/* LIVE TABLE BILL & SPLIT */}
      <Text style={styles.sectionTitle}>Live Table Bill (${grandTotal})</Text>
      <View style={styles.billCard}>
        <View style={styles.splitToggleRow}>
          {(['equal', 'items', 'cover'] as SplitMode[]).map(mode => (
            <Pressable
              key={mode}
              style={[styles.splitTab, splitMode === mode && styles.splitTabActive]}
              onPress={() => setSplitMode(mode)}
            >
              <Text style={[styles.splitTabText, splitMode === mode && styles.splitTabTextActive]}>
                {mode === 'equal' ? 'Split Equally' : mode === 'items' ? 'Pay My Items' : 'Cover Table'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.orderList}>
          {tableOrders.map(item => (
            <View key={item.id} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderItemName}>{item.name}</Text>
                <Text style={styles.orderItemBy}>by {item.orderedBy}</Text>
              </View>
              <Text style={styles.orderItemPrice}>${item.price}</Text>
            </View>
          ))}
        </View>

        <View style={styles.billDivider} />
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalVal}>${subtotal}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>HST Tax (13%)</Text><Text style={styles.totalVal}>${tax}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Service Gratuity (18%)</Text><Text style={styles.totalVal}>${tip}</Text></View>
        <View style={[styles.totalRow, { marginTop: 6 }]}><Text style={styles.grandLabel}>Total Table Bill</Text><Text style={styles.grandVal}>${grandTotal}</Text></View>

        <View style={styles.yourShareBox}>
          <Text style={styles.yourShareLabel}>YOUR AMOUNT TO PAY ({splitMode === 'equal' ? `1/${members.length}th share` : splitMode === 'items' ? 'your items + tax/tip' : 'entire table'}):</Text>
          <Text style={styles.yourShareAmount}>${splitMode === 'equal' ? equalSplit : splitMode === 'items' ? myShare : grandTotal}</Text>
        </View>

        {/* PAYMENT BUTTONS */}
        <View style={styles.payActionGrid}>
          <Pressable style={[styles.payBtn, styles.payBtnApple]} onPress={() => handlePay('apple')}>
            <Text style={styles.payBtnAppleText}> Pay with Pay</Text>
          </Pressable>
          <Pressable style={[styles.payBtn, styles.payBtnCard]} onPress={() => handlePay('card')}>
            <Text style={styles.payBtnCardText}>💳 Credit / Debit</Text>
          </Pressable>
          <Pressable style={[styles.payBtn, styles.payBtnCash]} onPress={() => handlePay('cash')}>
            <Text style={styles.payBtnCashText}>💵 Pay Cash to Server</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────────────────────
   PRIVATE EVENTS: WEDDINGS, BAPTISMS & PRIVATE GALAS
   ───────────────────────────────────────────────────────────── */
function PrivateEventsView() {
  const [subTab, setSubTab] = useState<PrivateSubTab>('rsvp');
  const [eventPin, setEventPin] = useState('WED-2025');
  const [isUnlocked, setIsUnlocked] = useState(true);
  const [rsvpAttending, setRsvpAttending] = useState(true);
  const [partyCount, setPartyCount] = useState(2);
  const [guest1Meal, setGuest1Meal] = useState<MealChoice>('lamb');
  const [guest2Meal, setGuest2Meal] = useState<MealChoice>('sea_bass');
  const [dietaryNotes, setDietaryNotes] = useState('Gluten-free for guest 2');
  const [giftAmount, setGiftAmount] = useState('250');
  const [giftMessage, setGiftMessage] = useState('Να ζήσετε! Wishing you a lifetime of joy, love, and health!');
  const [giftFund, setGiftFund] = useState('honeymoon');
  const [photoList, setPhotoList] = useState<{ id: string; user: string; table: string; cap: string; time: string }[]>([
    { id: '1', user: 'Nikos P.', table: 'Table 4', cap: 'First dance zeibekiko! 🥂', time: '5m ago' },
    { id: '2', user: 'Sofia M.', table: 'Table 2', cap: 'Stefana & Koumbaroi blessing 🙏', time: '18m ago' },
    { id: '3', user: 'George P.', table: 'Table 4', cap: 'Table 4 raising a glass to Dimitris & Maria!', time: '24m ago' },
  ]);
  const [newPhotoCap, setNewPhotoCap] = useState('');
  const [rsvpSuccess, setRsvpSuccess] = useState<string | null>(null);

  const handleRsvpSubmit = () => {
    setRsvpSuccess('✓ RSVP confirmed for Party of ' + partyCount + '! Meals: Lamb & Sea Bass logged for Table 4.');
  };

  const handleSendGift = (method: 'apple' | 'card' | 'envelope') => {
    if (method === 'envelope') {
      Alert.alert('Noted! 💌', 'Marked that you are bringing a traditional cash envelope to the reception gift box.');
    } else {
      Alert.alert('Gift Sent! 🎁', `$${giftAmount} sent to Dimitris & Maria's ${giftFund === 'honeymoon' ? 'Santorini Honeymoon Fund' : 'Digital Shakoula'} via ${method === 'apple' ? 'Apple Pay' : 'Card'}. Personal note attached.`);
    }
  };

  const handleDropPhoto = () => {
    if (!newPhotoCap) return;
    setPhotoList([
      { id: 'p_' + Date.now(), user: 'George (You)', table: 'Table 4', cap: newPhotoCap, time: 'Just now' },
      ...photoList,
    ]);
    setNewPhotoCap('');
    Alert.alert('Photo Uploaded! 📸', 'Your photo has been projected to the live reception screen slideshow!');
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* EVENT HEADER */}
      <View style={styles.privateHeaderBox}>
        <View style={styles.privatePillRow}>
          <Text style={styles.privatePillText}>💒 SACRAMENT OF HOLY MATRIMONY · PRIVATE INVITATION</Text>
        </View>
        <Text style={styles.privateTitle}>Dimitris &amp; Maria's Wedding</Text>
        <Text style={styles.privateSubtitle}>Saturday, June 28, 2025 · Toronto, ON</Text>
        <Text style={styles.privateParish}>St. Nicholas Greek Orthodox Church &amp; The Grand Ballroom</Text>
      </View>

      {/* SUBTABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.privateTabScroll}>
        {([
          ['rsvp', 'RSVP & Meals'],
          ['seating', 'My Seating'],
          ['registry', 'Digital Envelope / Shakoula'],
          ['photos', 'Live Photo Wall'],
          ['itinerary', 'Timetable & Koumbaroi'],
        ] as [PrivateSubTab, string][]).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.privateTabBtn, subTab === key && styles.privateTabBtnActive]}
            onPress={() => setSubTab(key)}
          >
            <Text style={[styles.privateTabText, subTab === key && styles.privateTabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 1. RSVP & MEAL CHOICE */}
      {subTab === 'rsvp' && (
        <View style={styles.privateCard}>
          <Text style={styles.privateCardTitle}>RSVP &amp; Meal Preferences</Text>
          <Text style={styles.privateCardSub}>Please confirm attendance by May 15, 2025.</Text>

          {rsvpSuccess && (
            <View style={styles.successBanner}>
              <Text style={styles.successText}>{rsvpSuccess}</Text>
            </View>
          )}

          <View style={styles.rsvpRow}>
            <Text style={styles.rsvpLabel}>Attendance Status:</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable style={[styles.choicePill, rsvpAttending && styles.choicePillActive]} onPress={() => setRsvpAttending(true)}>
                <Text style={[styles.choiceText, rsvpAttending && styles.choiceTextActive]}>Joyfully Accept</Text>
              </Pressable>
              <Pressable style={[styles.choicePill, !rsvpAttending && styles.choicePillActive]} onPress={() => setRsvpAttending(false)}>
                <Text style={[styles.choiceText, !rsvpAttending && styles.choiceTextActive]}>Regretfully Decline</Text>
              </Pressable>
            </View>
          </View>

          {rsvpAttending && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Guest 1 (George) — Entrée Choice:</Text>
                <View style={styles.mealGrid}>
                  {(['lamb', 'sea_bass', 'vegetarian'] as MealChoice[]).map(m => (
                    <Pressable key={m} style={[styles.mealBtn, guest1Meal === m && styles.mealBtnActive]} onPress={() => setGuest1Meal(m)}>
                      <Text style={[styles.mealBtnText, guest1Meal === m && styles.mealBtnTextActive]}>
                        {m === 'lamb' ? '🍖 Roasted Greek Lamb' : m === 'sea_bass' ? '🐟 Fresh Aegean Sea Bass' : '🌱 Gemista / Vegetarian'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Guest 2 (Eleni) — Entrée Choice:</Text>
                <View style={styles.mealGrid}>
                  {(['lamb', 'sea_bass', 'vegetarian'] as MealChoice[]).map(m => (
                    <Pressable key={m} style={[styles.mealBtn, guest2Meal === m && styles.mealBtnActive]} onPress={() => setGuest2Meal(m)}>
                      <Text style={[styles.mealBtnText, guest2Meal === m && styles.mealBtnTextActive]}>
                        {m === 'lamb' ? '🍖 Roasted Greek Lamb' : m === 'sea_bass' ? '🐟 Fresh Aegean Sea Bass' : '🌱 Gemista / Vegetarian'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Dietary Requirements or Allergies:</Text>
                <TextInput
                  style={styles.textInput}
                  value={dietaryNotes}
                  onChangeText={setDietaryNotes}
                  placeholder="e.g. Celiac / Nut Allergy"
                  placeholderTextColor="#64748f"
                />
              </View>

              <Pressable style={[styles.payBtn, styles.payBtnCard, { marginTop: 10 }]} onPress={handleRsvpSubmit}>
                <Text style={styles.payBtnCardText}>Confirm Wedding RSVP</Text>
              </Pressable>
            </>
          )}
        </View>
      )}

      {/* 2. SEATING ASSIGNMENT */}
      {subTab === 'seating' && (
        <View style={styles.privateCard}>
          <Text style={styles.privateCardTitle}>Your Seating Assignment</Text>
          <View style={styles.tableSpotlight}>
            <Text style={styles.tableSpotlightBadge}>ASSIGNED TABLE</Text>
            <Text style={styles.tableSpotlightName}>Table 4 — Koumbaroi &amp; Close Family</Text>
            <Text style={styles.tableSpotlightDesc}>Beside the main dance floor · Table Host: Panagiotis K. (Koumbaros)</Text>
          </View>

          <Text style={[styles.sectionTitle, { fontSize: 16 }]}>Guests Seated with You:</Text>
          <View style={styles.tablematesList}>
            <View style={styles.tablemateRow}><Text style={styles.tmName}>George Panagopoulos</Text><Text style={styles.tmMeal}>Lamb · Table 4</Text></View>
            <View style={styles.tablemateRow}><Text style={styles.tmName}>Eleni K.</Text><Text style={styles.tmMeal}>Sea Bass · Gluten-Free</Text></View>
            <View style={styles.tablemateRow}><Text style={styles.tmName}>Panagiotis K. (Koumbaros)</Text><Text style={styles.tmMeal}>Lamb · Koumbaros</Text></View>
            <View style={styles.tablemateRow}><Text style={styles.tmName}>Maria V. (Koumbara)</Text><Text style={styles.tmMeal}>Sea Bass</Text></View>
            <View style={styles.tablemateRow}><Text style={styles.tmName}>Father Vassilios &amp; Presvytera</Text><Text style={styles.tmMeal}>Parish Priest</Text></View>
          </View>
        </View>
      )}

      {/* 3. DIGITAL ENVELOPE / SHAKOULA & REGISTRY */}
      {subTab === 'registry' && (
        <View style={styles.privateCard}>
          <Text style={styles.privateCardTitle}>Digital Envelope (Shakoula) &amp; Registry</Text>
          <Text style={styles.privateCardSub}>Bless the newlyweds directly with a wedding gift and personal note.</Text>

          <View style={styles.fundSelectRow}>
            <Pressable style={[styles.fundCard, giftFund === 'honeymoon' && styles.fundCardActive]} onPress={() => setGiftFund('honeymoon')}>
              <Text style={styles.fundIcon}>✈️</Text>
              <Text style={styles.fundName}>Santorini &amp; Milos Honeymoon</Text>
              <Text style={styles.fundProgress}>$3,850 of $5,000 raised</Text>
            </Pressable>
            <Pressable style={[styles.fundCard, giftFund === 'shakoula' && styles.fundCardActive]} onPress={() => setGiftFund('shakoula')}>
              <Text style={styles.fundIcon}>💌</Text>
              <Text style={styles.fundName}>Traditional Shakoula / Cash</Text>
              <Text style={styles.fundProgress}>Direct gift to couple</Text>
            </Pressable>
          </View>

          <Text style={styles.inputLabel}>Gift Amount:</Text>
          <View style={styles.amountGrid}>
            {['150', '250', '500', '1000'].map(amt => (
              <Pressable key={amt} style={[styles.amtBtn, giftAmount === amt && styles.amtBtnActive]} onPress={() => setGiftAmount(amt)}>
                <Text style={[styles.amtText, giftAmount === amt && styles.amtTextActive]}>${amt}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Personal Wedding Wish / Message:</Text>
          <TextInput
            style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
            multiline
            value={giftMessage}
            onChangeText={setGiftMessage}
          />

          <View style={styles.payActionGrid}>
            <Pressable style={[styles.payBtn, styles.payBtnApple]} onPress={() => handleSendGift('apple')}>
              <Text style={styles.payBtnAppleText}>Send ${giftAmount} with Pay</Text>
            </Pressable>
            <Pressable style={[styles.payBtn, styles.payBtnCard]} onPress={() => handleSendGift('card')}>
              <Text style={styles.payBtnCardText}>Send ${giftAmount} with Credit Card</Text>
            </Pressable>
            <Pressable style={[styles.payBtn, styles.payBtnCash]} onPress={() => handleSendGift('envelope')}>
              <Text style={styles.payBtnCashText}>💌 Bringing Physical Envelope to Reception</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 4. LIVE PHOTO WALL */}
      {subTab === 'photos' && (
        <View style={styles.privateCard}>
          <Text style={styles.privateCardTitle}>Live Reception Photo Wall</Text>
          <Text style={styles.privateCardSub}>Photos dropped here stream live onto the reception hall screen!</Text>

          <View style={styles.photoUploadBox}>
            <TextInput
              style={styles.photoInput}
              placeholder="Add a fun caption (e.g. Raising a glass from Table 4!)..."
              placeholderTextColor="#64748f"
              value={newPhotoCap}
              onChangeText={setNewPhotoCap}
            />
            <Pressable style={styles.photoDropBtn} onPress={handleDropPhoto}>
              <Text style={styles.photoDropBtnText}>📸 Drop Photo to Screen</Text>
            </Pressable>
          </View>

          <View style={styles.photoFeed}>
            {photoList.map(p => (
              <View key={p.id} style={styles.photoCard}>
                <View style={styles.photoCardHdr}>
                  <Text style={styles.photoCardUser}>{p.user} · {p.table}</Text>
                  <Text style={styles.photoCardTime}>{p.time}</Text>
                </View>
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.photoPlaceholderText}>📷 [Live Wedding Photo]</Text>
                </View>
                <Text style={styles.photoCaption}>{p.cap}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 5. TIMETABLE & KOUMBAROI */}
      {subTab === 'itinerary' && (
        <View style={styles.privateCard}>
          <Text style={styles.privateCardTitle}>Wedding Timetable &amp; Key Details</Text>
          
          <View style={styles.timelineList}>
            <View style={styles.timelineItem}>
              <Text style={styles.timeBadge}>1:00 PM</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeTitle}>Sacrament of Holy Matrimony 💒</Text>
                <Text style={styles.timeLoc}>St. Nicholas Greek Orthodox Church</Text>
                <Text style={styles.timeDesc}>Officiated by Father Vassilios · Koumbaroi: Panagiotis &amp; Maria</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <Text style={styles.timeBadge}>5:30 PM</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeTitle}>Cocktail Hour &amp; Mezedes 🍸</Text>
                <Text style={styles.timeLoc}>The Grand Ballroom Foyer</Text>
                <Text style={styles.timeDesc}>Live bouzouki acoustic performance &amp; Aegean appetizers</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <Text style={styles.timeBadge}>7:00 PM</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeTitle}>Grand Entrance &amp; Dinner 🍽</Text>
                <Text style={styles.timeLoc}>Main Ballroom · Table 4</Text>
                <Text style={styles.timeDesc}>Four-course Greek banquet with wine pairings</Text>
              </View>
            </View>

            <View style={styles.timelineItem}>
              <Text style={styles.timeBadge}>9:00 PM</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.timeTitle}>First Dance &amp; Zeibekiko 💃</Text>
                <Text style={styles.timeLoc}>Central Dance Floor</Text>
                <Text style={styles.timeDesc}>Celebration continues with live Greek band and DJ until late!</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────────────────────
   VENDOR / KITCHEN / HOST DISPLAY SYSTEM (KDS)
   ───────────────────────────────────────────────────────────── */
function VendorKDSView() {
  const [station, setStation] = useState<Station>('all');
  const [tickets, setTickets] = useState<LiveOrderTicket[]>([
    {
      id: 'TK-101',
      table: 'Table VIP-4',
      guestName: 'George P.',
      station: 'bar',
      total: 97,
      status: 'received',
      paymentMethod: 'apple_pay',
      time: '2m ago',
      items: [
        { name: 'Assyrtiko Santorini White', qty: 1 },
        { name: 'Mastiha Digestif Round (4 shots)', qty: 1 },
      ],
    },
    {
      id: 'TK-102',
      table: 'Table 12',
      guestName: 'Dimitris V.',
      station: 'kitchen',
      total: 56,
      status: 'preparing',
      paymentMethod: 'cash_pending',
      time: '6m ago',
      items: [
        { name: 'Grilled Mediterranean Octopus', qty: 2, notes: 'Extra lemon on side' },
      ],
    },
    {
      id: 'TK-103',
      table: 'Table VIP-1',
      guestName: 'National Bank Table',
      station: 'bar',
      total: 144,
      status: 'ready',
      paymentMethod: 'card',
      time: '9m ago',
      items: [
        { name: 'Greek Wine Xinomavro Naoussa', qty: 2 },
      ],
    },
    {
      id: 'TK-104',
      table: 'Table 8',
      guestName: 'Anna S.',
      station: 'kitchen',
      total: 40,
      status: 'received',
      paymentMethod: 'cash_pending',
      time: 'Just now',
      items: [
        { name: 'Spanakopita Artisanal Platter', qty: 2 },
        { name: 'Honey Loukoumades', qty: 1 },
      ],
    },
  ]);

  const advanceTicket = (id: string) => {
    setTickets(tickets.map(t => {
      if (t.id === id) {
        const nextStatus = t.status === 'received' ? 'preparing' : t.status === 'preparing' ? 'ready' : 'delivered';
        return { ...t, status: nextStatus };
      }
      return t;
    }));
  };

  const collectCash = (id: string) => {
    setTickets(tickets.map(t => {
      if (t.id === id) {
        return { ...t, paymentMethod: 'cash_collected' };
      }
      return t;
    }));
    Alert.alert('Cash Settlement Recorded', 'Cash collected and logged into register float.');
  };

  const filteredTickets = tickets.filter(t => station === 'all' || t.station === station);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.kdsHeader}>
        <View>
          <Text style={styles.kdsTitle}>Live Station &amp; KDS Display</Text>
          <Text style={styles.kdsSubtitle}>Orders routed live from guest in-seat table tabs.</Text>
        </View>
        <View style={styles.kdsLivePill}>
          <View style={styles.liveDot} />
          <Text style={styles.kdsLiveText}>LIVE DISPATCH</Text>
        </View>
      </View>

      {/* STATION SWITCHER */}
      <View style={styles.stationRow}>
        {(['all', 'kitchen', 'bar', 'host'] as Station[]).map(st => (
          <Pressable
            key={st}
            style={[styles.stationTab, station === st && styles.stationTabActive]}
            onPress={() => setStation(st)}
          >
            <Text style={[styles.stationTabText, station === st && styles.stationTabTextActive]}>
              {st === 'all' ? 'All Stations' : st === 'kitchen' ? '🍳 Kitchen KDS' : st === 'bar' ? '🍷 Bar Station' : '💵 Host / Cashier'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* TICKETS LIST */}
      <View style={styles.ticketGridKds}>
        {filteredTickets.map(t => (
          <View key={t.id} style={[styles.ticketCardKds, t.paymentMethod === 'cash_pending' && styles.ticketCardCashPending]}>
            <View style={styles.tKdsHeader}>
              <View>
                <Text style={styles.tKdsTable}>{t.table}</Text>
                <Text style={styles.tKdsGuest}>{t.guestName} · {t.time}</Text>
              </View>
              <View style={[styles.statusTag, t.status === 'ready' ? styles.statusReady : t.status === 'preparing' ? styles.statusPrep : styles.statusRecv]}>
                <Text style={styles.statusTagText}>{t.status.toUpperCase()}</Text>
              </View>
            </View>

            {/* CASH ALERT */}
            {t.paymentMethod === 'cash_pending' && (
              <View style={styles.cashAlertBox}>
                <Text style={styles.cashAlertText}>⚠️ CASH PAYMENT REQUESTED (${t.total})</Text>
                <Pressable style={styles.cashCollectBtn} onPress={() => collectCash(t.id)}>
                  <Text style={styles.cashCollectBtnText}>Collect Cash &amp; Settle</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.tKdsItemList}>
              {t.items.map((item, idx) => (
                <View key={idx} style={styles.tKdsItemRow}>
                  <Text style={styles.tKdsItemQty}>{item.qty}x</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tKdsItemName}>{item.name}</Text>
                    {item.notes ? <Text style={styles.tKdsItemNotes}>Note: {item.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.tKdsFooter}>
              <Text style={styles.tKdsTotal}>Total: ${t.total}</Text>
              {t.status !== 'delivered' && (
                <Pressable style={styles.advanceBtn} onPress={() => advanceTicket(t.id)}>
                  <Text style={styles.advanceBtnText}>
                    {t.status === 'received' ? 'Mark Preparing ➔' : t.status === 'preparing' ? 'Mark Ready for Runner ➔' : 'Mark Delivered ✓'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

/* ─────────────────────────────────────────────────────────────
   STANDARD ECOSYSTEM TABS
   ───────────────────────────────────────────────────────────── */
function Home({ onGoTable, onGoPrivate }: { onGoTable: () => void; onGoPrivate: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.seal}><Text style={styles.sealText}>Ζ</Text></View>
        <Text style={styles.kicker}>THE GREEK WORLD, CONNECTED</Text>
        <Text style={styles.heroTitle}>Find your people. Build what matters.</Text>
        <Text style={styles.heroBody}>The live ecosystem app for discovery, private weddings/baptisms, in-seat event ordering, group tab splitting, and operator dispatch.</Text>
        <View style={styles.row}>
          <Pressable style={[styles.action, styles.actionPrimary]} onPress={onGoPrivate}>
            <Text style={[styles.actionText, styles.actionTextPrimary]}>💒 Private Events &amp; Weddings</Text>
          </Pressable>
          <Pressable style={styles.action} onPress={onGoTable}>
            <Text style={styles.actionText}>🍽 In-Seat Table Tab</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Private &amp; Community Celebrations</Text>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>WEDDINGS · BAPTISMS · MEMORIALS</Text>
        <Text style={styles.cardTitle}>Private Invitations &amp; Digital Envelopes</Text>
        <Text style={styles.cardBody}>RSVP with meal selections, view assigned family seating, send traditional Shakoula/cash gifts with personal notes, and drop photos live to the reception screen.</Text>
        <Pressable style={[styles.action, styles.actionPrimary]} onPress={onGoPrivate}>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Open Dimitris &amp; Maria's Wedding</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Live Event Operations</Text>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>IN-SEAT &amp; SPLIT BILL</Text>
        <Text style={styles.cardTitle}>Table Tabs &amp; Bill Splitting</Text>
        <Text style={styles.cardBody}>Join your event table, order food &amp; wine in real time, split the check equally or by item, and pay with Apple Pay or Cash.</Text>
        <Pressable style={[styles.action, styles.actionPrimary]} onPress={onGoTable}>
          <Text style={[styles.actionText, styles.actionTextPrimary]}>Launch Guest Table App</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Ecosystem</Text>
      <ProductCard eyebrow="DISCOVER" title="The Greek directory" body="Search real businesses, churches, professionals, events, and places across the diaspora." path={ROUTES.discover} action="Search places" />
      <ProductCard eyebrow="COMMUNITY" title="The agora" body="See what the community is sharing, tag real places, and keep the conversation connected to the directory." path={ROUTES.community} action="Open Community" />
      <ProductCard eyebrow="BUSINESS" title="Your daily business desk" body="Plan content, use templates, manage your audience, publish to Zoi Community, and connect external networks." path={ROUTES.business} action="Open Business" />
    </ScrollView>
  );
}

function ProductCard({ eyebrow, title, body, path, action }: { eyebrow: string; title: string; body: string; path: string; action: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      <Pressable accessibilityRole="button" style={styles.action} onPress={() => openRoute(path)}>
        <Text style={styles.actionText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const ROUTES = {
  discover: '/explore',
  map: '/explore/map',
  business: '/social',
  tickets: '/tickets',
  intelligence: '/apps/intelligence/',
  command: '/apps/command-center/',
  community: '/community',
};

export default function App() {
  const [tab, setTab] = useState<MainTab>('home');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.topbar}>
        <Text style={styles.brand}>Zoi</Text>
        <Text style={styles.topbarHint}>Weddings, Tables &amp; KDS</Text>
      </View>
      <View style={styles.screen}>
        {tab === 'home' && <Home onGoTable={() => setTab('table')} onGoPrivate={() => setTab('private')} />}
        {tab === 'private' && <PrivateEventsView />}
        {tab === 'table' && <GuestTableView />}
        {tab === 'kds' && <VendorKDSView />}
        {tab === 'business' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Business Suite</Text>
            <ProductCard eyebrow="OPERATOR" title="Open Business Suite" body="Publishing, calendar, and analytics for Greek businesses." path={ROUTES.business} action="Launch Business Desk" />
          </ScrollView>
        )}
        {tab === 'tickets' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Tickets &amp; Events</Text>
            <ProductCard eyebrow="EVENTS" title="3D Tickets &amp; Door Mode" body="Real-time check-in, 3D venue builder, and seat maps." path={ROUTES.tickets} action="Open Tickets" />
          </ScrollView>
        )}
        {tab === 'more' && (
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.pageTitle}>Founder &amp; Intelligence</Text>
            <ProductCard eyebrow="CONSOLE" title="Command Center" body="Ingestion, health, and knowledge graph operations." path={ROUTES.command} action="Open Command Center" />
          </ScrollView>
        )}
      </View>
      <View style={styles.nav} accessibilityRole="tablist">
        {([
          ['home', 'Home', '⌂'],
          ['private', 'Weddings', '💒'],
          ['table', 'Table Tab', '🍽'],
          ['kds', 'KDS / Host', '⚡'],
          ['business', 'Business', '✦'],
          ['tickets', 'Tickets', '◇'],
          ['more', 'More', '•••'],
        ] as [MainTab, string, string][]).map(([key, label, ic]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} style={styles.navItem} onPress={() => setTab(key)}>
            <Text style={[styles.navIcon, tab === key && styles.navActive]}>{ic}</Text>
            <Text style={[styles.navLabel, tab === key && styles.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111f' },
  topbar: { height: 58, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1b3148', backgroundColor: '#091827' },
  brand: { color: '#f2f5fa', fontSize: 23, fontWeight: '800' },
  topbarHint: { color: '#87a0ba', fontSize: 12, marginLeft: 9 },
  screen: { flex: 1 },
  content: { padding: 18, paddingBottom: 40 },
  hero: { paddingVertical: 14, marginBottom: 14 },
  seal: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#d4af5f', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  sealText: { color: '#142238', fontSize: 26, fontWeight: '800' },
  kicker: { color: '#d4af5f', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 8 },
  heroTitle: { color: '#f2f5fa', fontSize: 30, lineHeight: 36, fontWeight: '800', marginBottom: 10 },
  heroBody: { color: '#9bb0c7', fontSize: 15, lineHeight: 22, marginBottom: 18 },
  pageTitle: { color: '#f2f5fa', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  sectionTitle: { color: '#f2f5fa', fontSize: 19, fontWeight: '800', marginTop: 18, marginBottom: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 16, padding: 16, marginBottom: 14 },
  eyebrow: { color: '#d4af5f', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginBottom: 6 },
  cardTitle: { color: '#f2f5fa', fontSize: 19, fontWeight: '800', marginBottom: 6 },
  cardBody: { color: '#9bb0c7', fontSize: 14, lineHeight: 20, marginBottom: 14 },
  action: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#34526e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  actionPrimary: { backgroundColor: '#4f9be8', borderColor: '#4f9be8' },
  actionText: { color: '#dce8f5', fontWeight: '700', fontSize: 13 },
  actionTextPrimary: { color: '#06101f' },
  nav: { height: 72, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#1b3148', backgroundColor: '#091827', flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 50 },
  navIcon: { color: '#718aa5', fontSize: 20, lineHeight: 24 },
  navLabel: { color: '#718aa5', fontSize: 10, fontWeight: '700', marginTop: 2 },
  navActive: { color: '#d4af5f' },

  /* Table styles */
  tableHeaderBox: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#d4af5f', borderRadius: 16, padding: 16, marginBottom: 14 },
  tableBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#5bc49a' },
  tableBadgeText: { color: '#d4af5f', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  tableTitle: { color: '#f2f5fa', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  tableSubtitle: { color: '#9bb0c7', fontSize: 13 },
  successBanner: { backgroundColor: 'rgba(91,196,154,0.15)', borderWidth: 1, borderColor: '#5bc49a', borderRadius: 12, padding: 12, marginBottom: 14 },
  successText: { color: '#5bc49a', fontWeight: '700', fontSize: 13 },

  memberScroll: { flexDirection: 'row', marginBottom: 8 },
  memberPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#132438', borderWidth: 1, borderColor: '#223d5a', borderRadius: 24, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, gap: 8 },
  memberAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4f9be8', alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  memberName: { color: '#f2f5fa', fontWeight: '700', fontSize: 12 },
  memberSub: { color: '#718aa5', fontSize: 10 },
  addMemberBtn: { borderWidth: 1, borderColor: '#d4af5f', borderStyle: 'dashed', borderRadius: 24, paddingHorizontal: 14, justifyContent: 'center', height: 42 },
  addMemberText: { color: '#d4af5f', fontWeight: '700', fontSize: 12 },

  menuGrid: { gap: 10, marginBottom: 14 },
  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 12, padding: 12 },
  menuName: { color: '#f2f5fa', fontWeight: '700', fontSize: 14 },
  menuCat: { color: '#718aa5', fontSize: 10, fontWeight: '700', marginTop: 2 },
  menuPrice: { color: '#d4af5f', fontWeight: '800', fontSize: 16, marginHorizontal: 10 },
  menuAddBtn: { backgroundColor: '#4f9be8', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  menuAddText: { color: '#06101f', fontWeight: '800', fontSize: 12 },

  giftCard: { backgroundColor: 'rgba(212,175,95,0.08)', borderWidth: 1, borderColor: 'rgba(212,175,95,0.3)', borderRadius: 14, padding: 14, marginBottom: 14 },
  giftTitle: { color: '#d4af5f', fontWeight: '800', fontSize: 15, marginBottom: 4 },
  giftBody: { color: '#9bb0c7', fontSize: 12, marginBottom: 10 },
  giftRow: { flexDirection: 'row', gap: 8 },
  giftInput: { flex: 1, backgroundColor: '#091827', borderWidth: 1, borderColor: '#223d5a', borderRadius: 8, paddingHorizontal: 10, color: '#fff', fontSize: 13 },
  giftBtn: { backgroundColor: '#d4af5f', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, justifyContent: 'center' },
  giftBtnText: { color: '#142238', fontWeight: '800', fontSize: 12 },

  billCard: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 16, padding: 16 },
  splitToggleRow: { flexDirection: 'row', gap: 6, marginBottom: 14, backgroundColor: '#08121e', padding: 4, borderRadius: 10 },
  splitTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  splitTabActive: { backgroundColor: '#1d3852' },
  splitTabText: { color: '#718aa5', fontSize: 11, fontWeight: '700' },
  splitTabTextActive: { color: '#f2f5fa', fontWeight: '800' },

  orderList: { gap: 8 },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderItemName: { color: '#dce8f5', fontSize: 13, fontWeight: '600' },
  orderItemBy: { color: '#64748f', fontSize: 11 },
  orderItemPrice: { color: '#f2f5fa', fontSize: 13, fontWeight: '700' },
  billDivider: { height: 1, backgroundColor: '#1d3852', marginVertical: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { color: '#718aa5', fontSize: 12 },
  totalVal: { color: '#dce8f5', fontSize: 12, fontWeight: '600' },
  grandLabel: { color: '#f2f5fa', fontSize: 15, fontWeight: '800' },
  grandVal: { color: '#d4af5f', fontSize: 17, fontWeight: '800' },

  yourShareBox: { backgroundColor: '#132438', borderRadius: 10, padding: 12, marginVertical: 14, alignItems: 'center' },
  yourShareLabel: { color: '#718aa5', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 4 },
  yourShareAmount: { color: '#5bc49a', fontSize: 26, fontWeight: '800' },

  payActionGrid: { gap: 8 },
  payBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  payBtnApple: { backgroundColor: '#f2f5fa' },
  payBtnAppleText: { color: '#06101f', fontWeight: '800', fontSize: 14 },
  payBtnCard: { backgroundColor: '#4f9be8' },
  payBtnCardText: { color: '#06101f', fontWeight: '800', fontSize: 14 },
  payBtnCash: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#d4af5f' },
  payBtnCashText: { color: '#d4af5f', fontWeight: '800', fontSize: 13 },

  /* KDS styles */
  kdsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  kdsTitle: { color: '#f2f5fa', fontSize: 22, fontWeight: '800' },
  kdsSubtitle: { color: '#718aa5', fontSize: 12 },
  kdsLivePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(91,196,154,0.15)', borderWidth: 1, borderColor: '#5bc49a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  kdsLiveText: { color: '#5bc49a', fontSize: 9, fontWeight: '800' },

  stationRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  stationTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852' },
  stationTabActive: { backgroundColor: '#4f9be8', borderColor: '#4f9be8' },
  stationTabText: { color: '#718aa5', fontSize: 11, fontWeight: '700' },
  stationTabTextActive: { color: '#06101f', fontWeight: '800' },

  ticketGridKds: { gap: 12 },
  ticketCardKds: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 14, padding: 14 },
  ticketCardCashPending: { borderColor: '#d4af5f', backgroundColor: 'rgba(212,175,95,0.06)' },
  tKdsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  tKdsTable: { color: '#f2f5fa', fontWeight: '800', fontSize: 16 },
  tKdsGuest: { color: '#718aa5', fontSize: 11, marginTop: 2 },
  statusTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusRecv: { backgroundColor: '#223d5a' },
  statusPrep: { backgroundColor: '#b8893b' },
  statusReady: { backgroundColor: '#5bc49a' },
  statusTagText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  cashAlertBox: { backgroundColor: 'rgba(212,175,95,0.12)', borderWidth: 1, borderColor: '#d4af5f', borderRadius: 8, padding: 10, marginVertical: 8 },
  cashAlertText: { color: '#d4af5f', fontWeight: '800', fontSize: 11, marginBottom: 6 },
  cashCollectBtn: { backgroundColor: '#d4af5f', paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  cashCollectBtnText: { color: '#142238', fontWeight: '800', fontSize: 11 },

  tKdsItemList: { marginVertical: 8, gap: 6 },
  tKdsItemRow: { flexDirection: 'row', gap: 8 },
  tKdsItemQty: { color: '#4f9be8', fontWeight: '800', fontSize: 13, width: 22 },
  tKdsItemName: { color: '#dce8f5', fontSize: 13, fontWeight: '600' },
  tKdsItemNotes: { color: '#d4af5f', fontSize: 11, marginTop: 1 },

  tKdsFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1d3852' },
  tKdsTotal: { color: '#9bb0c7', fontSize: 13, fontWeight: '700' },
  advanceBtn: { backgroundColor: '#4f9be8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  advanceBtnText: { color: '#06101f', fontWeight: '800', fontSize: 11 },

  /* Private Event & Wedding styles */
  privateHeaderBox: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#d4af5f', borderRadius: 16, padding: 18, marginBottom: 14 },
  privatePillRow: { marginBottom: 6 },
  privatePillText: { color: '#d4af5f', fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  privateTitle: { color: '#f2f5fa', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  privateSubtitle: { color: '#5dbedc', fontSize: 13, fontWeight: '700' },
  privateParish: { color: '#9bb0c7', fontSize: 12, marginTop: 2 },

  privateTabScroll: { flexDirection: 'row', marginBottom: 14 },
  privateTabBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', marginRight: 8 },
  privateTabBtnActive: { backgroundColor: '#d4af5f', borderColor: '#d4af5f' },
  privateTabText: { color: '#718aa5', fontSize: 11.5, fontWeight: '700' },
  privateTabTextActive: { color: '#142238', fontWeight: '800' },

  privateCard: { backgroundColor: '#0e1d30', borderWidth: 1, borderColor: '#1d3852', borderRadius: 16, padding: 16, marginBottom: 14 },
  privateCardTitle: { color: '#f2f5fa', fontSize: 18, fontWeight: '800', marginBottom: 4 },
  privateCardSub: { color: '#9bb0c7', fontSize: 12.5, marginBottom: 14 },

  rsvpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  rsvpLabel: { color: '#dce8f5', fontSize: 13, fontWeight: '700' },
  choicePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#132438', borderWidth: 1, borderColor: '#223d5a' },
  choicePillActive: { backgroundColor: '#5bc49a', borderColor: '#5bc49a' },
  choiceText: { color: '#718aa5', fontSize: 11.5, fontWeight: '700' },
  choiceTextActive: { color: '#06101f', fontWeight: '800' },

  formGroup: { marginBottom: 14 },
  inputLabel: { color: '#dce8f5', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  mealGrid: { gap: 6 },
  mealBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#132438', borderWidth: 1, borderColor: '#223d5a' },
  mealBtnActive: { backgroundColor: '#1f9ec9', borderColor: '#1f9ec9' },
  mealBtnText: { color: '#9bb0c7', fontSize: 12, fontWeight: '600' },
  mealBtnTextActive: { color: '#06101f', fontWeight: '800' },
  textInput: { backgroundColor: '#091827', borderWidth: 1, borderColor: '#223d5a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13 },

  tableSpotlight: { backgroundColor: 'rgba(212,175,95,0.1)', borderWidth: 1, borderColor: '#d4af5f', borderRadius: 12, padding: 14, marginBottom: 14 },
  tableSpotlightBadge: { color: '#d4af5f', fontSize: 9.5, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  tableSpotlightName: { color: '#f2f5fa', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  tableSpotlightDesc: { color: '#9bb0c7', fontSize: 12 },
  tablematesList: { gap: 6 },
  tablemateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1d3852' },
  tmName: { color: '#dce8f5', fontSize: 13, fontWeight: '600' },
  tmMeal: { color: '#d4af5f', fontSize: 12, fontWeight: '700' },

  fundSelectRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  fundCard: { flex: 1, backgroundColor: '#132438', borderWidth: 1, borderColor: '#223d5a', borderRadius: 12, padding: 12 },
  fundCardActive: { borderColor: '#d4af5f', backgroundColor: 'rgba(212,175,95,0.08)' },
  fundIcon: { fontSize: 22, marginBottom: 4 },
  fundName: { color: '#f2f5fa', fontWeight: '700', fontSize: 12, marginBottom: 2 },
  fundProgress: { color: '#5bc49a', fontSize: 10, fontWeight: '700' },

  amountGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  amtBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#132438', borderWidth: 1, borderColor: '#223d5a', alignItems: 'center' },
  amtBtnActive: { backgroundColor: '#d4af5f', borderColor: '#d4af5f' },
  amtText: { color: '#9bb0c7', fontWeight: '700', fontSize: 14 },
  amtTextActive: { color: '#142238', fontWeight: '800' },

  photoUploadBox: { backgroundColor: '#132438', borderRadius: 12, padding: 12, marginBottom: 14 },
  photoInput: { backgroundColor: '#091827', borderWidth: 1, borderColor: '#223d5a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#fff', fontSize: 13, marginBottom: 8 },
  photoDropBtn: { backgroundColor: '#4f9be8', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  photoDropBtnText: { color: '#06101f', fontWeight: '800', fontSize: 13 },

  photoFeed: { gap: 10 },
  photoCard: { backgroundColor: '#091827', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1d3852' },
  photoCardHdr: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  photoCardUser: { color: '#5dbedc', fontWeight: '700', fontSize: 12 },
  photoCardTime: { color: '#64748f', fontSize: 10 },
  photoPlaceholder: { height: 120, backgroundColor: '#132438', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  photoPlaceholderText: { color: '#718aa5', fontSize: 12 },
  photoCaption: { color: '#dce8f5', fontSize: 12 },

  timelineList: { gap: 12 },
  timelineItem: { flexDirection: 'row', gap: 12, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#1d3852' },
  timeBadge: { color: '#d4af5f', fontWeight: '800', fontSize: 13, width: 62 },
  timeTitle: { color: '#f2f5fa', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  timeLoc: { color: '#5dbedc', fontSize: 12, fontWeight: '600' },
  timeDesc: { color: '#9bb0c7', fontSize: 11.5, marginTop: 2 },
});


