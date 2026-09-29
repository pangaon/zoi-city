import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const runner = fileURLToPath(new URL('../../scripts/run-tests.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'zoi-runner-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'tests');
  mkdirSync(dir);
  writeFileSync(join(dir, 'example.test.mjs'), "import test from 'node:test'; test('example', () => {});");
  return dir;
}
function run(dir, mode, timeout = '2000') {
  return spawnSync(process.execPath, [runner, dir, mode], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, TEST_SUITE_TIMEOUT_MS: timeout },
  });
}
test('standalone timeout fails verification instead of silently passing', t => {
  const dir = fixture(t);
  writeFileSync(join(dir, 'run.mjs'), 'setInterval(() => {}, 1000);');
  const result = run(dir, '--local', '1000');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FAILED: timed out/);
  assert.doesNotMatch(result.stdout, /treated as skipped/);
});
test('local verification excludes network contracts but runs page source checks', t => {
  const dir = fixture(t);
  mkdirSync(join(dir, 'contract'));
  mkdirSync(join(dir, 'pages'));
  writeFileSync(join(dir, 'contract/run.mjs'), 'process.exit(9);');
  writeFileSync(join(dir, 'pages/run.mjs'), "process.exit(process.argv.includes('--local') ? 0 : 8);");
  assert.equal(run(dir, '--local').status, 0);
  assert.equal(run(dir, '--live').status, 1);
});
test('runner rejects conflicting verification modes', t => {
  const dir = fixture(t);
  const result = spawnSync(process.execPath, [runner, dir, '--local', '--live'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
});
