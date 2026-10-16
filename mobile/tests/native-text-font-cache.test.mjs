import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, symlinkSync, statSync, renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtures = join(root, 'tests/fixtures/react-native-0.86.3-font-cache');
const require = createRequire(import.meta.url);
const patch = require('../scripts/patch-native-text-font-cache.cjs');
const sha = value => createHash('sha256').update(value).digest('hex');
function privateInstall(run) {
  const directory = mkdtempSync(join(tmpdir(), 'zoi-native-font-cache-'));
  const rn = join(directory, 'node_modules/react-native');
  mkdirSync(rn, {recursive: true});
  cpSync(join(fixtures, 'Libraries'), join(rn, 'Libraries'), {recursive: true});
  renameSync(join(rn, patch.FILE + '.txt'), join(rn, patch.FILE));
  writeFileSync(join(rn, 'package.json'), JSON.stringify({name: 'react-native', version: '0.86.3'}));
  try {return run(directory, rn);} finally {rmSync(directory, {recursive: true, force: true});}
}

test('exact private RN install is patched once; both host configs accept scale and all other bytes reverse', () => privateInstall((directory, rn) => {
  const filename = join(rn, patch.FILE), original = readFileSync(filename);
  const mode = statSync(filename).mode;
  assert.equal(sha(original), patch.BEFORE);
  assert.equal(patch.patchNativeTextFontCache(directory), 'patched');
  const current = readFileSync(filename, 'utf8');
  assert.equal(sha(current), patch.AFTER);
  assert.equal(current.match(/    fontSizeMultiplier: true,/g)?.length, 2);
  assert.equal(current.replaceAll('    fontSizeMultiplier: true,\n', ''), original.toString());
  assert.equal(statSync(filename).mode, mode);
  assert.equal(patch.patchNativeTextFontCache(directory), 'already-patched');
  assert.equal(readFileSync(filename, 'utf8'), current);
}));

test('unsupported version, unknown source and partially applied patch fail closed without edits', () => {
  for (const kind of ['version', 'source', 'partial']) privateInstall((directory, rn) => {
    const filename = join(rn, patch.FILE);
    if (kind === 'version') writeFileSync(join(rn, 'package.json'), '{"version":"0.86.4"}');
    if (kind === 'source') writeFileSync(filename, readFileSync(filename, 'utf8') + '\n');
    if (kind === 'partial') writeFileSync(filename, readFileSync(filename, 'utf8').replace('    maxFontSizeMultiplier: true,', '    maxFontSizeMultiplier: true,\n    fontSizeMultiplier: true,'));
    const before = readFileSync(filename);
    assert.throws(() => patch.patchNativeTextFontCache(directory), /native_text_patch_(unsupported_version|source_drift)/);
    assert.deepEqual(readFileSync(filename), before);
  });
});

test('shared symlinked dependencies and redirected native file are refused without modifying their targets', () => privateInstall((directory, rn) => {
  const outer = mkdtempSync(join(tmpdir(), 'zoi-shared-native-font-'));
  try {
    symlinkSync(join(directory, 'node_modules'), join(outer, 'node_modules'));
    const before = readFileSync(join(rn, patch.FILE));
    assert.throws(() => patch.patchNativeTextFontCache(outer), /shared_dependencies/);
    assert.deepEqual(readFileSync(join(rn, patch.FILE)), before);
    const filename = join(rn, patch.FILE), target = join(directory, 'original.js');
    writeFileSync(target, before);rmSync(filename);symlinkSync(target, filename);
    assert.throws(() => patch.patchNativeTextFontCache(directory), /invalid_file/);
    assert.deepEqual(readFileSync(target), before);
  } finally {rmSync(outer, {recursive: true, force: true});}
}));

test('real offline npm ci executes the shipped postinstall in its own dependency install', () => privateInstall((directory, rn) => {
  // A tarball dependency makes npm create its own actual files, never a shared
  // local file: directory symlink. No registry/network/package download occurs.
  const tarball = 'react-native-0.86.3.tgz';
  execFileSync('npm', ['pack', '--offline', '--ignore-scripts', '--pack-destination', directory], {cwd: rn, stdio: 'pipe'});
  rmSync(join(directory, 'node_modules'), {recursive: true, force: true});
  mkdirSync(join(directory, 'scripts'));
  cpSync(join(root, 'scripts/patch-native-text-font-cache.cjs'), join(directory, 'scripts/patch-native-text-font-cache.cjs'));
  const app = JSON.parse(readFileSync(join(root, 'package.json')));
  writeFileSync(join(directory, 'package.json'), JSON.stringify({name: 'zoi-private-install-proof', version: '1.0.0', private: true, scripts: {postinstall: app.scripts.postinstall}, dependencies: {'react-native': 'file:./' + tarball}}));
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--offline', '--no-audit', '--no-fund'], {cwd: directory, stdio: 'pipe'});
  const output = execFileSync('npm', ['ci', '--offline', '--no-audit', '--no-fund'], {cwd: directory, encoding: 'utf8'});
  assert.match(output, /Native text font cache: patched/);
  assert.equal(sha(readFileSync(join(directory, 'node_modules/react-native', patch.FILE))), patch.AFTER);
  assert.equal(JSON.parse(readFileSync(join(directory, 'package-lock.json'))).packages[''].hasInstallScript, true);
  const lock = JSON.parse(readFileSync(join(root, 'package-lock.json')));
  assert.equal(lock.packages[''].hasInstallScript, true);
  assert.equal(app.scripts.postinstall, 'node scripts/patch-native-text-font-cache.cjs');
}));

test('actual RN host configuration registers scale for root, nested and selectable text after the guarded patch', () => privateInstall((directory, rn) => {
  const babel = require('@babel/core');
  function registered() {
    const source = readFileSync(join(rn, patch.FILE), 'utf8');
    const code = babel.transformSync(source, {filename: 'TextNativeComponent.js', babelrc: false, configFile: false,
      presets: [require.resolve('babel-preset-expo')], caller: {name: 'metro', platform: 'android'}}).code;
    const components = new Map();
    const module = {exports: {}};
    const deps = {
      '../../src/private/featureflags/ReactNativeFeatureFlags': {enablePreparedTextLayout: () => true},
      '../NativeComponent/ViewConfig': {createViewConfig: value => value},
      '../ReactNative/UIManager': {},
      '../Renderer/shims/createReactNativeComponentClass': (name, config) => {const result = config();components.set(name, result);return result;},
    };
    vm.runInNewContext(code, {module, exports: module.exports, global: {RN$Bridgeless: true}, require: name => {
      if (name.startsWith('@babel/runtime/')) return require(name);
      assert.ok(name in deps, name);return deps[name];
    }});
    return components;
  }
  const before = registered();
  for (const name of ['RCTText', 'RCTVirtualText', 'RCTSelectableText']) assert.equal('fontSizeMultiplier' in before.get(name).validAttributes, false);
  patch.patchNativeTextFontCache(directory);
  const after = registered();
  for (const name of before.keys()) {
    assert.equal(after.get(name).validAttributes.fontSizeMultiplier, true);
    const stripped = JSON.parse(JSON.stringify(after.get(name)));
    delete stripped.validAttributes.fontSizeMultiplier;
    // Realm-independent full config equality, including direct events.
    assert.equal(JSON.stringify(stripped), JSON.stringify(before.get(name)));
  }
}));

test('unmodified RN C++ cache actually reuses a new host tag, but splits current scale and nested scale', () => {
  const directory = mkdtempSync(join(tmpdir(), 'zoi-native-cpp-cache-'));
  try {
    const manifest = JSON.parse(readFileSync(join(fixtures, 'manifest.json')));
    const installed = resolve(require.resolve('react-native/package.json'), '..');
    for (const [filename, hash] of Object.entries(manifest.files)) {
      assert.equal(sha(readFileSync(join(fixtures, filename + (filename.endsWith('.js') ? '.txt' : '')))), hash, filename);
      const current = sha(readFileSync(join(installed, filename)));
      if (filename === patch.FILE) assert.ok([patch.BEFORE, patch.AFTER].includes(current), 'installed guarded JS config');
      else assert.equal(current, hash, 'installed ' + filename);
    }
    const includes = join(directory, 'include');
    cpSync(join(fixtures, 'ReactCommon'), includes, {recursive: true});
    for (const filename of ['react/renderer/attributedstring/AttributedString.h', 'react/renderer/attributedstring/ParagraphAttributes.h', 'react/renderer/core/LayoutConstraints.h']) {
      const target = join(includes, filename);mkdirSync(resolve(target, '..'), {recursive: true});
      writeFileSync(target, '#include "support-types.h"\n');
    }
    const binary = join(directory, 'cache-key');
    execFileSync('g++', ['-std=c++20', '-Wall', '-Wextra', '-Werror', '-I', includes, '-I', fixtures, join(fixtures, 'cache-key.cpp'), '-o', binary], {stdio: 'pipe'});
    const result = JSON.parse(execFileSync(binary, [], {encoding: 'utf8'}));
    assert.deepEqual(result, {actual_RN_headers: true, host_remount_cache_hit: true, font_field_cache_miss: true, same_scale_hit: true, scale_return_hit: true, nested_field_split: true, measurement_calls: 3});
  } finally {rmSync(directory, {recursive: true, force: true});}
});

test('pinned actual native parser forwards scale into cache while Android SP remains the existing painting path', () => {
  const rn = resolve(require.resolve('react-native/package.json'), '..');
  assert.equal(JSON.parse(readFileSync(join(rn, 'package.json'))).version, '0.86.3');
  const contract = JSON.parse(readFileSync(join(fixtures, 'native-contracts.json')));
  const sources = {};
  for (const [filename, hash] of Object.entries(contract.files)) {
    const bytes = readFileSync(join(rn, filename));assert.equal(sha(bytes), hash, filename);sources[filename] = bytes.toString();
  }
  const source = suffix => sources[Object.keys(sources).find(name => name.endsWith(suffix))];
  assert.match(source('Text.js'), /\.\.\.restProps/);
  assert.match(source('Text.js'), /<NativeVirtualText \{\.\.\.processedProps\}/);
  assert.match(source('BaseTextProps.cpp'), /textAttributes\.fontSizeMultiplier = convertRawProp\([\s\S]*?"fontSizeMultiplier"/);
  assert.match(source('ParagraphShadowNode.cpp'), /textAttributes\.fontSizeMultiplier = layoutContext\.fontSizeMultiplier;\s*textAttributes\.apply\(getConcreteProps\(\)\.textAttributes\)/);
  assert.match(source('TextAttributes.cpp'), /fontSizeMultiplier = !std::isnan\(textAttributes\.fontSizeMultiplier\)\s*\? textAttributes\.fontSizeMultiplier\s*: fontSizeMultiplier/);
  assert.match(source('conversions.h'), /TA_KEY_FONT_SIZE_MULTIPLIER, textAttributes\.fontSizeMultiplier/);
  assert.match(source('TextAttributeProps.kt'), /TA_KEY_FONT_SIZE_MULTIPLIER -> \{\}/);
  assert.match(source('TextAttributeProps.kt'), /if \(allowFontScaling\)[\s\S]*?toPixelFromSP\(fontSize, maxFontSizeMultiplier\)/);
  assert.match(source('TextAttributeProps.kt'), /else ceil\(toPixelFromDIP\(fontSize\)/);
  assert.match(source('PixelUtil.kt'), /TypedValue\.applyDimension\(TypedValue\.COMPLEX_UNIT_SP/);
});
