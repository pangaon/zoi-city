import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const jsx = (type, props, key) => ({ type, props, key });
const compile = () => {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/ParishHome.tsx', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react') return { useEffect() {}, useMemo: fn => fn(), useState: value => [value, () => {}] };
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react-native') return { Image: 'Image', Linking: { openURL() { return Promise.resolve(); } }, Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x, absoluteFill: { position: 'absolute', inset: 0 } }, useColorScheme: () => 'light', useWindowDimensions: () => ({ width: 390 }), View: 'View' };
      if (name === 'expo-linear-gradient') return { LinearGradient: 'Gradient' };
      if (name === './ScaleText') return { ScaleText: 'Text' };
      throw Error('Unexpected dependency ' + name);
    },
  });
  return module.exports.ParishHome;
};
const walk = (tree, result = []) => { if (Array.isArray(tree)) tree.forEach(x => walk(x, result)); else if (tree && typeof tree === 'object') { result.push(tree); walk(tree.props?.children, result); } return result; };
const bodyText = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(bodyText).join(' ') : node && typeof node === 'object' ? bodyText(node.props?.children) : '';
const id = '1b19a3d2-4290-4a63-98f2-0b8d00453c19';

test('parish home renders only supplied identity, and listed community actions stay bound to this listing', () => {
  const run = [];
  const tree = compile()({ profile: { id, name: 'Holy Wisdom', location: 'Toronto', description: 'Sunday services and community meals.', website: 'https://parish.example.org', photo: 'https://parish.example.org/hero.jpg', logo: 'https://parish.example.org/logo.png' }, onBack() {}, publishedColors: { accent: '#56653B', background: '#F7F5EF', foreground: '#17251E' }, actions: { calendar: { listingId: id, run: value => run.push(['calendar', value]) }, groups: { listingId: id, run: value => run.push(['groups', value]) }, volunteer: { listingId: '2c3a1464-a184-4b18-a849-c0f0adf7a62e', run: value => run.push(['volunteer', value]) } } });
  const all = walk(tree);
  assert.match(bodyText(tree), /Holy Wisdom/);
  assert.match(bodyText(tree), /Sunday services and community meals/);
  assert.doesNotMatch(bodyText(tree), /Volunteer/);
  for (const label of ['Calendar', 'Groups']) all.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === label).props.onPress();
  assert.deepEqual(run, [['calendar', id], ['groups', id]]);
});

test('parish contact controls reject unsafe web links and text follows published identity', () => {
  const tree = compile()({ profile: { id, name: 'St Mark', website: 'javascript:alert(1)', phone: '+14165550123', phoneHref: 'tel:+14165550123', email: 'hello@example.org' }, onBack() {}, publishedColors: { accent: '#F4C542' } });
  const all = walk(tree), labels = all.filter(node => node.type === 'Pressable').map(node => node.props.accessibilityLabel);
  assert.deepEqual(labels, ['Back', 'Call parish', 'Email parish']);
  const website = all.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Open parish website');
  assert.equal(website, undefined);
});
