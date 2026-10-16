import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/HospitalityHome.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const mock = (name) => ({
  useMemo: (fn) => fn(), useState: (initial) => [initial, () => {}],
  jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment'),
  SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', View: 'View',
  Pressable: 'Pressable', Image: 'Image', Linking: {openURL: async () => {}},
  StyleSheet: {create: (x) => x, absoluteFill: {}}, useWindowDimensions: () => ({width: 390, fontScale: 1}),
  LinearGradient: 'LinearGradient', ScaleText: 'Text',
});
const exports = {};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {
  URL, RegExp, Math, Object, String, Number, Boolean, Array,
}).call(null, (name) => mock(name), {exports}, exports);
const hospitalityHandoffs = exports.hospitalityHandoffs;
const listing = '0c664154-38c0-49ef-8b21-cfd4ca597ad0';

test('only listing-bound booking and enquiry routes are exposed', () => {
  const result = hospitalityHandoffs({
    id: listing,
    booking: `/book/${listing}`,
    inquiry: `/inquiries/${listing}`,
  });
  assert.equal(result.booking, listing);
  assert.equal(result.inquiry, listing);
  assert.equal(hospitalityHandoffs({id: listing, booking: `/book/${'9'.repeat(8)}-${'9'.repeat(4)}-${'9'.repeat(4)}-${'9'.repeat(4)}-${'9'.repeat(12)}`}).booking, '');
  assert.equal(hospitalityHandoffs({id: listing, inquiry: '/inquiries/not-a-listing'}).inquiry, '');
  assert.equal(hospitalityHandoffs({id: 'not-a-uuid', booking: `/book/${listing}`}).booking, '');
});

test('external handoffs require safe HTTPS and phone links require a plausible number', () => {
  const good = hospitalityHandoffs({id: listing, website: 'https://hotel.example/stay', provider: 'https://booking.example/room', phone: '+1 (416) 555-0123'});
  assert.equal(good.website, 'https://hotel.example/stay');
  assert.equal(good.provider, 'https://booking.example/room');
  assert.equal(good.phone, 'tel:+14165550123');
  assert.equal(hospitalityHandoffs({id: listing, website: 'http://hotel.example'}).website, '');
  assert.equal(hospitalityHandoffs({id: listing, provider: 'https://user:pass@booking.example'}).provider, '');
  assert.equal(hospitalityHandoffs({id: listing, phone: '123'}).phone, '');
});

test('screen uses source images with a recoverable error state and passed design tokens', () => {
  assert.match(source, /onError=\{\(\)=>setFailed\(true\)\}/);
  assert.match(source, /fallbackColor=\{design\.surface\}/);
  for (const token of ['background', 'surface', 'ink', 'muted', 'accent', 'primaryColor', 'line']) {
    assert.ok(source.includes(`d.${token}`), `missing design token ${token}`);
  }
  assert.doesNotMatch(source, /\b(?:nightly rate|\$\d+|available tonight|\d+ rooms left)\b/i);
  assert.match(source, /ScaleText as Text/);
});
