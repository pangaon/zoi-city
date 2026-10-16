import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {commerceProduct, displayCommercePrice} from '../src/commerce.ts';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../src/RetailerHome.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
}}).outputText;
const exports = {};
const mocks = {
  react: {useEffect: () => {}, useMemo: (fn) => fn(), useState: (value) => [value, () => {}]},
  'react/jsx-runtime': {jsx: () => null, jsxs: () => null, Fragment: Symbol('Fragment')},
  'react-native': {ActivityIndicator: 'ActivityIndicator', Image: 'Image', Linking: {openURL: async () => {}}, Pressable: 'Pressable', SafeAreaView: 'SafeAreaView', ScrollView: 'ScrollView', StyleSheet: {create: (x) => x}, TextInput: 'TextInput', useWindowDimensions: () => ({width: 390, fontScale: 1}), View: 'View'},
  './ScaleText': {ScaleText: 'Text'},
  './commerce': {commerceProduct, displayCommercePrice},
};
vm.runInNewContext(`(function(require,module,exports){${compiled}\n})`, {URL, Set, Error, String, Array, Object, Math}).call(null, (name) => mocks[name], {exports}, exports);
const {retailerProducts} = exports;

const seller = 'Verified Grove';
const product = (overrides = {}) => ({
  id: 'gid://shopify/Product/12345678', handle: 'olive-oil', title: 'Early harvest olive oil',
  description: 'Harvested in October.', vendor: seller, type: 'Pantry', available: true,
  url: 'https://buygreek.shop/products/olive-oil',
  price_min: {price: '14.50', currency: 'CAD'},
  image: 'https://cdn.shopify.com/s/files/1/1/olive-oil.jpg', image_alt: 'Olive oil bottle',
  images: [{url: 'https://cdn.shopify.com/s/files/1/1/olive-oil.jpg', alt: 'Olive oil bottle'}],
  variants: [{id: '123456789', title: '500 ml', available: true, price: '14.50', currency: 'CAD', image: null, options: [{name: 'Size', value: '500 ml'}]}],
  more_variants: false, ...overrides,
});
const catalogue = (rows = [product()], overrides = {}) => ({status: 'ready', source: 'buygreek.shop', seller, products: rows, ...overrides});

test('retailer list accepts canonical BuyGreek product data only for the exact bound seller', () => {
  const rows = retailerProducts(catalogue(), seller);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Early harvest olive oil');
  assert.equal(rows[0].variants[0].price, '14.50');
  assert.equal(retailerProducts(catalogue([]), seller).length, 0);
});

test('catalogue rejects missing binding, another seller, unsupported source and malformed records', () => {
  for (const input of [
    catalogue([product()], {source: 'unknown'}),
    catalogue([product()], {seller: 'Other Store'}),
    catalogue([product({vendor: 'Other Store'})]),
    catalogue([product({url: 'https://buygreek.shop/products/different-product'})]),
    catalogue([product(), product()]),
    catalogue(Array.from({length: 121}, (_, i) => product({id: `gid://shopify/Product/${12345678 + i}`, handle: `item-${i}`, url: `https://buygreek.shop/products/item-${i}`}))),
  ]) assert.throws(() => retailerProducts(input, seller));
  assert.throws(() => retailerProducts(catalogue(), ''));
  assert.throws(() => retailerProducts(catalogue(), 'Different seller'));
});

test('screen keeps compact, photo-led white-label presentation and honest recovery states', () => {
  assert.match(source, /profile\.photo/);
  assert.match(source, /styles\.productImage/);
  assert.match(source, /catalogue\.status === 'loading'/);
  assert.match(source, /catalogue\.status === 'error'/);
  assert.match(source, /No products are listed for this retailer yet/);
  assert.match(source, /Retry products/);
  assert.match(source, /onError=\{\(\)\s*=>\s*setFailed\(true\)\}/);
  assert.match(source, /accessibilityLabel="Search this catalogue"/);
  assert.match(source, /accessibilityLabel=\{`\$\{variant\.title/);
  assert.match(source, /fontScale/);
  assert.match(source, /ScaleText as Text/);
  assert.doesNotMatch(source, /Your story starts here|Discover the magic|handcrafted with love/i);
  assert.doesNotMatch(source, /payment collected|Order confirmed|stock confirmed/i);
  for (const token of ['background', 'ink', 'muted', 'accent', 'primaryColor', 'surface', 'line']) assert.ok(source.includes(`d.${token}`), `missing passed design token ${token}`);
});
