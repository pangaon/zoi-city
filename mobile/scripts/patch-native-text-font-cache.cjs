#!/usr/bin/env node
'use strict';

// RN 0.86.3 already keys native text measurements by fontSizeMultiplier and
// parses that prop. Expose it through the JS host configs so Android can bind
// the key to the current system scale. Android still paints using system SP.
const {createHash} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VERSION = '0.86.3';
const FILE = 'Libraries/Text/TextNativeComponent.js';
const BEFORE = '3e783f0b9fcf2e2905d4be23449c77970d29de39755b966cdd259b2f671d5740';
const AFTER = 'fa6ba86a1c1387c94367be09147a35a5e33ba9aebe89db79f36dc2eed3062094';
const sha = value => createHash('sha256').update(value).digest('hex');

function patchNativeTextFontCache(mobileRoot = path.resolve(__dirname, '..')) {
  const project = fs.realpathSync(mobileRoot);
  const expectedRoot = path.join(project, 'node_modules', 'react-native');
  const rnRoot = fs.realpathSync(expectedRoot);
  // A checkout may share dependencies with other worktrees. Never patch those.
  if (rnRoot !== expectedRoot) throw new Error('native_text_patch_shared_dependencies');
  const version = JSON.parse(fs.readFileSync(path.join(rnRoot, 'package.json'), 'utf8')).version;
  if (version !== VERSION) throw new Error('native_text_patch_unsupported_version');
  const filename = path.join(rnRoot, FILE);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || fs.realpathSync(filename) !== filename) throw new Error('native_text_patch_invalid_file');
  const original = fs.readFileSync(filename);
  const hash = sha(original);
  if (hash === AFTER) return 'already-patched';
  if (hash !== BEFORE) throw new Error('native_text_patch_source_drift');
  const source = original.toString('utf8');
  const patched = source.replaceAll('    maxFontSizeMultiplier: true,',
    '    maxFontSizeMultiplier: true,\n    fontSizeMultiplier: true,');
  if (sha(patched) !== AFTER) throw new Error('native_text_patch_output_drift');
  const temporary = filename + '.zoi-' + process.pid + '-' + require('node:crypto').randomUUID();
  try {
    fs.writeFileSync(temporary, patched, {flag: 'wx', mode: stat.mode & 0o777});
    fs.chmodSync(temporary, stat.mode & 0o777);
    fs.renameSync(temporary, filename);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return 'patched';
}

module.exports = {patchNativeTextFontCache, VERSION, FILE, BEFORE, AFTER};
if (require.main === module) {
  try {
    console.log('Native text font cache: ' + patchNativeTextFontCache());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
