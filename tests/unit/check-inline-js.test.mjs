import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, '../../scripts/check-inline-js.mjs');
const { extractScripts } = await import(pathToFileURL(SCRIPT).href);

function runOn(files) {
  const dir = mkdtempSync(join(tmpdir(), 'zoi-test-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dir, name), content, 'utf8');
    }
    return spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
  } finally {
    setTimeout(() => rmSync(dir, { recursive: true, force: true }), 0);
  }
}

test('extractScripts: skips src=, JSON-LD; keeps inline JS and modules', () => {
  const html = `<html><head>
    <script src="/x.js"></script>
    <script type="application/ld+json">{"@type":"Thing"}</script>
    <script>var a = 1;</script>
    <script type="module">import.meta.url;</script>
  </head></html>`;
  const blocks = extractScripts(html);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].isModule, false);
  assert.equal(blocks[1].isModule, true);
});

test('passes on valid inline JS', () => {
  const r = runOn({
    'ok.html': '<html><head><title>t</title></head><body><script>const x = {a:1}; console.log(x);</script></body></html>',
  });
  assert.equal(r.status, 0, r.stderr);
});

test('fails (exit 1) on a parse-broken inline script', () => {
  const r = runOn({
    'bad.html': '<html><body><script>function broken( {</script></body></html>',
  });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /FAIL/);
});

test('exit 2 when no HTML files exist', () => {
  const r = runOn({ 'readme.txt': 'no html here' });
  assert.equal(r.status, 2);
});
