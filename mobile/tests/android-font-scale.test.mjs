import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

test('generated Android font handling preserves every other activity, permission and route field', () => {
  const baseline = JSON.parse(readFileSync(new URL('./fixtures/android-manifest-before-font-scale.json', import.meta.url)));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const cli = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
  const config = JSON.parse(execFileSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], {
    cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  }));
  const manifest = config._internal.modResults.android.manifest;
  const activity = manifest.manifest.application[0].activity.find(row => row.$['android:name'] === '.MainActivity');
  assert.ok(activity, 'current main activity must exist');
  const flags = activity.$['android:configChanges'].split('|');
  assert.equal(flags.filter(flag => flag === 'fontScale').length, 1);
  activity.$['android:configChanges'] = flags.filter(flag => flag !== 'fontScale').join('|');
  assert.deepEqual(manifest, baseline, 'font handling must not change permissions, navigation, orientation or other manifest values');
});
