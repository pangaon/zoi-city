import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('the replacement marketing version advances beyond the verified released Apple version', () => {
  const source = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
  const released = JSON.parse(readFileSync(new URL('./fixtures/apple-live-version-20261016.json', import.meta.url)));
  assert.equal(released.app_id, '1464901778');
  assert.equal(released.bundle_id, source.expo.ios.bundleIdentifier);
  assert.equal(released.state, 'READY_FOR_DISTRIBUTION');
  function parts(version) {
    assert.match(version, /^\d+\.\d+(?:\.\d+)?$/);
    return [...version.split('.').map(Number), 0].slice(0, 3);
  }
  const next = parts(source.expo.version), previous = parts(released.version);
  const difference = next.map((n, i) => n - previous[i]).find(n => n !== 0) || 0;
  assert.ok(difference > 0, `The native release must advance beyond verified live version ${released.version}.`);
});

test('generated iPhone privacy settings satisfy Apple 90683 without enabling background or motion access', () => {
  const project = fileURLToPath(new URL('../', import.meta.url));
  const resolve = createRequire(new URL('../package.json', import.meta.url));
  const cli = join(dirname(resolve.resolve('expo/package.json')), 'bin/cli');
  const result = spawnSync(process.execPath, [cli, 'config', '--type', 'introspect', '--json'], { cwd: project, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr?.slice(0, 1000));
  const generated = JSON.parse(result.stdout);
  const plist = generated._internal.modResults.ios.infoPlist;
  const source = JSON.parse(readFileSync(new URL('../app.json', import.meta.url)));
  const location = source.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-location')[1];
  assert.equal(generated.ios.bundleIdentifier, 'com.usgreekscan.zoi');
  assert.equal(plist.NSMotionUsageDescription, location.motionUsagePermission);
  assert.match(plist.NSMotionUsageDescription, /does not request or collect motion data/);
  assert.equal(plist.NSLocationWhenInUseUsageDescription, location.locationWhenInUsePermission);
  assert.equal(plist.NSLocationAlwaysUsageDescription, undefined);
  assert.equal(plist.NSLocationAlwaysAndWhenInUseUsageDescription, undefined);
  assert.ok(!plist.UIBackgroundModes?.includes('location'));
  assert.equal(location.isAndroidMotionActivityEnabled, false);
  assert.equal(location.isAndroidBackgroundLocationEnabled, false);
  assert.equal(location.isIosBackgroundLocationEnabled, false);
});
