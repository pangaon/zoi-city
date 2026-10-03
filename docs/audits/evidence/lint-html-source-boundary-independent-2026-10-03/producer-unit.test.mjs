import test from 'node:test';
import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(here, '../../scripts/lint-html.mjs');
const { lintHtml } = await import(pathToFileURL(SCRIPT).href);

const GOOD = `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zoi</title></head><body>ok</body></html>`;

test('clean page passes', () => {
  assert.deepEqual(lintHtml(GOOD), []);
});

test('missing viewport and title are reported', () => {
  const problems = lintHtml('<html><head></head><body></body></html>');
  assert.ok(problems.some((p) => p.includes('viewport')));
  assert.ok(problems.some((p) => p.includes('<title>')));
});

test('duplicate <head> is reported, but <head> inside a comment is not counted', () => {
  const dup = lintHtml(GOOD.replace('<body>', '<head></head><body>'));
  assert.ok(dup.some((p) => p.includes('exactly one <head>')));
  const commented = lintHtml(GOOD.replace('<body>', '<body><!-- mentions <head> in prose -->'));
  assert.deepEqual(commented, []);
});

test('<header> does not count as <head>', () => {
  assert.deepEqual(lintHtml(GOOD.replace('ok', '<header>nav</header>')), []);
});

test('literal TODO/FIXME leak is reported with a line number', () => {
  const problems = lintHtml(GOOD + '\n<!-- TODO: remove before launch -->');
  assert.equal(problems.length, 1);
  assert.match(problems[0], /"TODO".*line \d+/);
});

test('exemptStructure skips head/viewport/title but still catches TODO', () => {
  assert.deepEqual(lintHtml('google-site-verification: token', { exemptStructure: true }), []);
  const p = lintHtml('token FIXME', { exemptStructure: true });
  assert.equal(p.length, 1);
});

test('CLI excludes exact raw-source evidence directory while malformed product and other docs fail', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'zoi-html-boundary-'));
  try {
    mkdirSync(resolve(root, 'docs/audits/evidence/property'), { recursive: true });
    writeFileSync(resolve(root, 'index.html'), GOOD);
    writeFileSync(resolve(root, 'docs/audits/evidence/property/contact-card.html'), '<details>Original publisher fragment</details>');
    const run = () => spawnSync(process.execPath, [SCRIPT, root], { encoding: 'utf8' });
    assert.equal(run().status, 0);
    writeFileSync(resolve(root, 'profile.html'), '<main>Missing document structure</main>');
    const product = run();
    assert.equal(product.status, 1);
    assert.match(product.stderr, /profile\.html/);
    rmSync(resolve(root, 'profile.html'));
    mkdirSync(resolve(root, 'docs/evidence'), { recursive: true });
    writeFileSync(resolve(root, 'docs/evidence/page.html'), '<main>Other docs must still be checked</main>');
    assert.equal(run().status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
