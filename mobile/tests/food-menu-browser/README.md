This is a controlled browser fixture for the actual native BusinessProfile,
normalizeProfile, FoodMenu and shared public Food models. It uses the real
existing React/React Native Web packages, with no installation or paid build.

```sh
node mobile/tests/food-menu-browser/build.cjs
OUTPUT_DIR=/tmp/independent-native-food \
BUNDLE_PATH=/tmp/zoi-native-food-bundle.js \
node mobile/tests/food-menu-browser/verify.mjs
(cd mobile && node --test tests/*.test.mjs)
mobile/node_modules/.bin/tsc --noEmit -p mobile
```

ZOI_PLAYWRIGHT_MODULE and CHROMIUM_EXECUTABLE_PATH override the existing local
browser dependencies. Use unique OUTPUT_DIR and BUNDLE_PATH for independent
review, passing the same BUNDLE_PATH when building and running.

The fixture substitutes only the unrelated Auth/Bookings/EventHome/ArtistHome
module boundary. Its fixed client records actual Profile requests and refuses
any reader except home_entity. Controlled failure/retry/unpublish cases exercise
the real Profile effect and stale-result clearing. There is no API/Auth/provider
network; the browser denies every request outside its localhost server. Linking
records handoffs in memory and can fail once to test recovery. No email, order,
enquiry, reservation or provider action is submitted.

RN Web does not implement native system text scaling. A fixture-only Text and
TextInput adapter multiplies font/line-height points once at1×/2×. Production
still imports react-native and uses platform font scaling without caps. These
results are not installed Android/iOS, TalkBack or native font-metric proof. The
lead owns one coherent binary build and actual installed verification.

source-fixture.json derives all151 exact names/prices/notes and the four official
sections2/2/2/145 from retained public official source SHA256
98327c9a383605c9630e977d3715b67aa4a7a8b967533c74bae09a61ffb1f6df.
It has a synthetic identity/contact solely to exercise safe local handoffs.
public-home-entity.json is the exact retained anonymous production home_entity
response supplied by root from the Hellenic151 public verification, not an owner
preview or private draft. The actual-public case mounts that complete unchanged
server shape and confirms all151 and tail search. No live read occurs here.

15 cases cover bakery/restaurant at390×844/844×390 and1×/2×, full-list search,
source section selection,12→24→all→12, official handoff, private question/email
handoff, failure/recovery, owner removal/clear, sparse and held source, long Greek
keyboard activation/focus recovery and actual read/retry/unpublish behavior.
The term “Sardines in Can” correctly matches both the final item and the distinct
source item “Sardines in Cans”; exact names/prices remain unchanged.

Shared Food/source-policy dependencies are read-only. The pending manual receipt
server projection/helpers must be integrated before any later manual-receipt
native acceptance. This source passes complete home_entity context into existing
helpers; it does not infer absent owner identity, create receipt flags, project
private drafts or implement a second canonical reader/writer.
