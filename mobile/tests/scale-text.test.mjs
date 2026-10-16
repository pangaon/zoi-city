import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const inventory = JSON.parse(readFileSync(new URL('./fixtures/native-text-import-sites.json', import.meta.url)));
const root = new URL('../../', import.meta.url);

test('all 54 registered Text sites match their reviewed import baselines and JSX inventory', () => {
  assert.equal(inventory.sites.length, 54);
  let count = 0;
  for (const item of inventory.sites) {
    const source = readFileSync(new URL(item.path, root), 'utf8');
    const redirect = item.path === 'mobile/App.tsx'
      ? "import {ScaleText as Text} from './src/ScaleText';\n"
      : "import {ScaleText as Text} from './ScaleText';\n";
    assert.equal(source.split(redirect).length, 2, item.path);
    const current = ts.createSourceFile(item.path, source, ts.ScriptTarget.Latest, true);
    const nativeImport = current.statements.find(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === 'react-native');
    assert.ok(nativeImport, item.path);
    const reversed = source.replace(redirect, '').replace(nativeImport.getText(current), item.original_import);
    assert.equal(createHash('sha256').update(reversed).digest('hex'), item.sha256, item.path);
    function visit(n) {
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(current) === 'Text') count++;
      ts.forEachChild(n, visit);
    }
    visit(current);
  }
  assert.equal(count, inventory.jsx_nodes);
});

test('every applicable runtime RN Text import uses the shared component; TextInput imports remain independent', () => {
  const files = ['mobile/App.tsx', ...readdirSync(new URL('../src/', import.meta.url)).filter(n => /\.[jt]sx?$/.test(n)).map(n => 'mobile/src/' + n)];
  const remaining = [];
  for (const path of files) {
    if (path === 'mobile/src/ScaleText.tsx') continue;
    const source = readFileSync(new URL(path, root), 'utf8'), tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
    for (const n of tree.statements) {
      if (!ts.isImportDeclaration(n) || n.moduleSpecifier.text !== 'react-native') continue;
      const bindings = n.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings) && bindings.elements.some(e => (e.propertyName || e.name).text === 'Text' && !e.isTypeOnly)) remaining.push(path);
    }
  }
  assert.deepEqual(remaining, []);
});

function renderAt(platform, scale, props, ref) {
  const source = readFileSync(new URL('../src/ScaleText.tsx', import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
  const module = {exports: {}}, native = {};
  const dependencies = {
    react: {forwardRef: render => render, createElement: (type, value) => {const {key, ...props} = value;return {type, props, key};}},
    'react-native': {Text: native, Platform: {OS: platform}, useWindowDimensions: () => ({fontScale: scale})},
    'react/jsx-runtime': {jsx: (type, value, key) => ({type, props: value, key})},
  };
  vm.runInNewContext(js, {module, exports: module.exports, require: name => {
    assert.ok(name in dependencies, name); return dependencies[name];
  }});
  return {element: module.exports.ScaleText(props, ref), native};
}

test('native host follows actual scale; all caller props, children and callback ref are forwarded without mutation', () => {
  const ref = () => {}, press = () => {}, child = {nested: true};
  const props = Object.freeze({children: child, onPress: press, allowFontScaling: false, maxFontSizeMultiplier: 1.5, numberOfLines: 2, accessibilityLabel: 'Actual place', selectable: true});
  for (const platform of ['android', 'ios']) for (const scale of [1, 2, 1.3]) {
    const {element, native} = renderAt(platform, scale, props, ref);
    assert.equal(element.type, native); assert.equal(element.key, scale);
    assert.equal(element.props.ref, ref);
    for (const key of Object.keys(props)) assert.equal(element.props[key], props[key], key);
    assert.equal(Object.keys(element.props).length, Object.keys(props).length + (platform === 'android' ? 2 : 1));
    if (platform === 'android') assert.equal(element.props.fontSizeMultiplier, scale);
    else assert.equal('fontSizeMultiplier' in element.props, false);
  }
});

test('web host key stays stable across font and viewport changes; default scaling is not overridden', () => {
  const ref = {current: null};
  for (const scale of [1, 2, 1]) {
    const {element} = renderAt('web', scale, {children: 'Actual text'}, ref);
    assert.equal(element.key, 'web'); assert.equal(element.props.ref, ref);
    assert.equal('allowFontScaling' in element.props, false);
    assert.equal('style' in element.props, false);
    assert.equal('fontSizeMultiplier' in element.props, false);
  }
});
