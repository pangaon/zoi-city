import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

for (const script of ['check-inline-js.mjs', 'lint-html.mjs']) {
  test(`${script} ignores recovery archives while checking current pages`, t => {
    const root = mkdtempSync(join(tmpdir(), 'zoi-archive-check-'));
    t.after(() => rmSync(root, {recursive:true, force:true}));
    mkdirSync(join(root, '.recovery'));
    const good = '<html><head><title>Zoi</title><meta name="viewport" content="width=device-width"></head><body><script>const good = true;</script></body></html>';
    const bad = '<html><body><script>const = ;</script></body></html>';
    writeFileSync(join(root, 'index.html'), good);
    writeFileSync(join(root, '.recovery', 'old.html'), bad);
    const path = fileURLToPath(new URL(`../../scripts/${script}`, import.meta.url));
    assert.equal(spawnSync(process.execPath, [path, root], {encoding:'utf8'}).status, 0);
    writeFileSync(join(root, 'current.html'), bad);
    assert.equal(spawnSync(process.execPath, [path, root], {encoding:'utf8'}).status, 1);
  });
}

// Keep the live verifier on the same published RPC contract as the map client.
test('geo live check uses supported pagination parameters', () => {
  const source = readFileSync(new URL('../contract/run.mjs', import.meta.url), 'utf8');
  assert.match(source, /rpc\('explore_geo', \{ p_limit: 10, p_offset: 0 \}\)/);
  assert.doesNotMatch(source, /rpc\('explore_geo', \{ p_q:/);
  assert.match(source, /hasFields\(row, \['slug', 'name', 'lat', 'lng'/);
});
