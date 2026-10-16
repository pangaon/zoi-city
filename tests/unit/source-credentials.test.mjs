import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { credentialFindings, scanTrackedFiles } from '../../scripts/check-source-credentials.mjs';

test('detects capture credentials and reports metadata without values', () => {
  const key = 'AI' + 'za' + 'x'.repeat(35);
  const findings = credentialFindings(`publisher\n<script src="maps?key=${key}"></script>`);
  assert.deepEqual(findings, [{ type: 'Google API key', line: 2 }]);
  assert.ok(!JSON.stringify(findings).includes(key));
  assert.deepEqual(credentialFindings('[REDACTED_GOOGLE_API_KEY]'), []);
});

test('detects common provider secrets without rejecting a public anon JWT', () => {
  const tokens = ['gh' + 'p_' + 'a'.repeat(36), 'AK' + 'IA' + 'A'.repeat(16), 'sk_' + 'live_' + 'a'.repeat(24), ['-----BEGIN ' + 'PRIVATE KEY-----', 'YWJjZA==', '-----END ' + 'PRIVATE KEY-----'].join('\n')];
  assert.equal(credentialFindings(tokens.join('\n')).length, 4);
  assert.deepEqual(credentialFindings('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.public-signature'), []);
});

test('includes audit captures and checks staged bytes independently of working tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'zoi-secret-check-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'docs/audits/evidence'), { recursive: true });
    const path = 'docs/audits/evidence/capture.source';
    writeFileSync(join(root, path), 'AI' + 'za' + 'x'.repeat(35));
    execFileSync('git', ['add', path], { cwd: root });
    writeFileSync(join(root, path), '[REDACTED_GOOGLE_API_KEY]');
    assert.equal(scanTrackedFiles(root).findings.length, 0);
    const staged = scanTrackedFiles(root, { staged: true });
    assert.deepEqual(staged.findings, [{ path, type: 'Google API key', line: 1 }]);
    execFileSync('git', ['add', path], { cwd: root });
    assert.equal(scanTrackedFiles(root, { staged: true }).findings.length, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

function repository(t) {
  const root = mkdtempSync(join(tmpdir(), 'zoi-credential-git-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function oracle(root) {
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  return { files: names.length, findings: names.flatMap(path => credentialFindings(execFileSync('git', ['--no-replace-objects', 'show', `:${path}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 }).toString('utf8')).map(f => ({ path, ...f }))) };
}
function stage(root, name, bytes) {
  writeFileSync(join(root, name), bytes);
  execFileSync('git', ['--literal-pathspecs', 'add', '--', name], { cwd: root });
}
function instrumentGit(t, root, mutation = '') {
  const actual = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const bin = join(root, '.probe-bin'); mkdirSync(bin);
  const log = join(bin, 'calls.jsonl');
  // Delegate to actual Git in the actual fixture repository; only output-corruption
  // cases alter its returned bytes. This never substitutes fake staged contents.
  writeFileSync(join(bin, 'git'), '#!/usr/bin/env node\n' +
    `const {execFileSync}=require('node:child_process'),fs=require('node:fs');const args=process.argv.slice(2),input=fs.readFileSync(0);fs.appendFileSync(${JSON.stringify(log)},JSON.stringify(args)+'\\n');let bytes=execFileSync(${JSON.stringify(actual)},args,{input,maxBuffer:70*1024*1024});` + mutation + '\nprocess.stdout.write(bytes);\n', { mode: 0o700 });
  const old = process.env.PATH; process.env.PATH = bin + ':' + old;
  t.after(() => { process.env.PATH = old; });
  return () => readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line));
}

test('staged oracle parity covers binary, exact paths, identical blobs, symlinks and working-tree independence', async t => {
  const root = repository(t), secret = 'gh' + 'p_' + 'z'.repeat(36);
  for (const name of ['line\nbreak.txt', 'tab\tname.txt', ':leading.txt', 'Ελληνικά name.txt', '-option.txt']) stage(root, name, '\n' + secret);
  stage(root, 'binary.data', Buffer.concat([Buffer.from([0, 255, 10]), Buffer.from(secret), Buffer.from([0, 254])]));
  stage(root, 'deleted-after-stage', secret); rmSync(join(root, 'deleted-after-stage'));
  const { symlinkSync } = await import('node:fs'); symlinkSync(secret, join(root, 'link')); execFileSync('git', ['add', 'link'], { cwd: root });
  const expected = oracle(root), calls = instrumentGit(t, root);
  const actual = scanTrackedFiles(root, { staged: true });
  assert.deepEqual(actual, expected); assert.equal(actual.findings.length, 8);
  assert.equal(calls().length, 3); // one index, one metadata, one bounded body batch
  assert.equal(scanTrackedFiles(root).findings.length, 6); // deleted file and symlink excluded as before
});

test('all current credential signatures and lines retain exact staged oracle results', t => {
  const root = repository(t), tokens = ['AI' + 'za' + 'x'.repeat(35), 'github_' + 'pat_' + 'a'.repeat(45), 'AS' + 'IA' + 'A'.repeat(16), 'sk_' + 'test_' + 'b'.repeat(20), ['-----BEGIN RSA ' + 'PRIVATE KEY-----', 'YWJjZA==', '-----END RSA ' + 'PRIVATE KEY-----'].join('\n')];
  stage(root, 'captured-source', tokens.join('\n'));
  assert.deepEqual(scanTrackedFiles(root, { staged: true }), oracle(root));
  assert.equal(scanTrackedFiles(root, { staged: true }).findings.length, 5);
});

test('empty index, intent-to-add and replacement refs never hide original staged bytes', t => {
  const root = repository(t); assert.deepEqual(scanTrackedFiles(root, { staged: true }), { files: 0, findings: [] });
  stage(root, 'original', 'AI' + 'za' + 'x'.repeat(35));
  const oid = execFileSync('git', ['rev-parse', ':original'], { cwd: root, encoding: 'utf8' }).trim();
  const clean = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: 'redacted', encoding: 'utf8' }).trim();
  execFileSync('git', ['replace', oid, clean], { cwd: root });
  writeFileSync(join(root, 'intent'), 'unstaged'); execFileSync('git', ['add', '-N', 'intent'], { cwd: root });
  assert.deepEqual(scanTrackedFiles(root, { staged: true }), oracle(root));
  assert.equal(scanTrackedFiles(root, { staged: true }).findings.length, 1);
});

test('unmerged index and missing or nonblob objects fail closed before returning a scan', t => {
  const root = repository(t); stage(root, 'file', 'clean');
  const oid = execFileSync('git', ['rev-parse', ':file'], { cwd: root, encoding: 'utf8' }).trim();
  execFileSync('git', ['update-index', '--index-info'], { cwd: root, input: `0 ${'0'.repeat(40)}\tfile\n100644 ${oid} 1\tfile\n100644 ${oid} 2\tfile\n100644 ${oid} 3\tfile\n` });
  assert.throws(() => scanTrackedFiles(root, { staged: true }), /credential_index_unmerged/);
  execFileSync('git', ['read-tree', '--empty'], { cwd: root });
  execFileSync('git', ['update-index', '--add', '--cacheinfo', `160000,${'1'.repeat(40)},missing-submodule`], { cwd: root });
  assert.throws(() => scanTrackedFiles(root, { staged: true }), /credential_object_unavailable/);
  execFileSync('git', ['read-tree', '--empty'], { cwd: root });
  const tree = execFileSync('git', ['mktree'], { cwd: root, input: '', encoding: 'utf8' }).trim();
  execFileSync('git', ['update-index', '--add', '--cacheinfo', `160000,${tree},not-a-blob`], { cwd: root });
  assert.throws(() => scanTrackedFiles(root, { staged: true }), /credential_object_unavailable/);
});

test('32MiB batch boundary includes framing and 64MiB singleton retains the tail credential', t => {
  const root = repository(t), limit = 64 * 1024 * 1024, key = 'AI' + 'za' + 'x'.repeat(35);
  const a = Buffer.alloc(16 * 1024 * 1024); a[0] = 1;
  const b = Buffer.alloc(16 * 1024 * 1024); b[0] = 2;
  const c = Buffer.alloc(limit); c.write(key, limit - key.length);
  stage(root, 'first', a); stage(root, 'second', b); stage(root, 'maximum', c);
  const calls = instrumentGit(t, root), result = scanTrackedFiles(root, { staged: true });
  assert.equal(result.files, 3); assert.deepEqual(result.findings, [{ path: 'maximum', type: 'Google API key', line: 1 }]);
  assert.equal(calls().filter(args => args.includes('--batch')).length, 3); // 16+16MiB cannot share a32MiB group after headers
});

test('larger than64MiB refuses after metadata without reading any body', t => {
  const root = repository(t); stage(root, 'oversize', Buffer.alloc(64 * 1024 * 1024 + 1));
  const calls = instrumentGit(t, root);
  assert.throws(() => scanTrackedFiles(root, { staged: true }), /credential_blob_size_limit/);
  assert.equal(calls().filter(args => args.includes('--batch')).length, 0);
});

for (const [label, mutation] of [
  ['OID', `if(args.includes('--batch'))bytes[0]=bytes[0]===97?98:97;`],
  ['type', `if(args.includes('--batch'))bytes=Buffer.from(bytes.toString().replace(' blob ',' tree '));`],
  ['size', `if(args.includes('--batch'))bytes=Buffer.from(bytes.toString().replace('blob 5','blob 4'));`],
  ['terminator', `if(args.includes('--batch'))bytes[bytes.length-1]=0;`],
  ['truncated', `if(args.includes('--batch'))bytes=bytes.subarray(0,bytes.length-1);`],
  ['trailing', `if(args.includes('--batch'))bytes=Buffer.concat([bytes,Buffer.from('x')]);`],
  ['Git failure', `if(args.includes('--batch'))process.exit(2);`],
]) test(`unexpected Git ${label} fails closed on actual staged fixture`, t => {
  const root = repository(t); stage(root, 'file', 'clean'); instrumentGit(t, root, mutation);
  assert.throws(() => scanTrackedFiles(root, { staged: true }));
});

test('SHA256 Git repositories retain staged object identity and shared path findings', t => {
  const root = mkdtempSync(join(tmpdir(), 'zoi-credential-sha256-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', '--object-format=sha256'], { cwd: root });
  const value = 'AI' + 'za' + 'x'.repeat(35); stage(root, 'one', value); stage(root, 'two', value);
  assert.deepEqual(scanTrackedFiles(root, { staged: true }), oracle(root));
  assert.equal(scanTrackedFiles(root, { staged: true }).findings.length, 2);
});

test('failed Git output never exposes staged credential bytes in errors or CLI output', t => {
  const root = repository(t), key = 'AI' + 'za' + 'x'.repeat(35); stage(root, 'file', key);
  instrumentGit(t, root, `if(args.includes('--batch')){process.stdout.write(bytes);process.stderr.write(${JSON.stringify(key)});process.exit(2);}`);
  assert.throws(() => scanTrackedFiles(root, { staged: true }), error => error.message === 'credential_git_read_failed' && !String(error).includes(key));
  try { execFileSync(process.execPath, [new URL('../../scripts/check-source-credentials.mjs', import.meta.url).pathname, root, '--staged'], { encoding: 'utf8', stdio: 'pipe' }); assert.fail('CLI must refuse'); }
  catch (error) { assert(error.status); assert(!String(error.stdout).includes(key)); assert(!String(error.stderr).includes(key)); assert.match(String(error.stderr), /credential_git_read_failed/); }
});


test('working-tree and staged scans accept a real Git path list larger than oneMiB and inspect its tail', t => {
  const root = repository(t);
  const oid = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: root, input: 'clean', encoding: 'utf8' }).trim();
  // Missing working files represent a sparse checkout; Git still tracks every path.
  const prefix = 'a'.repeat(90) + '/' + 'b'.repeat(90) + '/';
  const names = Array.from({ length: 6000 }, (_, i) => prefix + String(i).padStart(5, '0') + '.txt');
  const index = names.map(name => `100644 ${oid}\t${name}\n`).join('');
  execFileSync('git', ['update-index', '--index-info'], { cwd: root, input: index, maxBuffer: 32 * 1024 * 1024 });
  stage(root, 'zz-tail-secret', 'AI' + 'za' + 'x'.repeat(35));
  const listed = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
  assert.ok(listed.length > 1024 * 1024);
  const expected = { files: 6001, findings: [{ path: 'zz-tail-secret', type: 'Google API key', line: 1 }] };
  assert.deepEqual(scanTrackedFiles(root), expected);
  assert.deepEqual(scanTrackedFiles(root, { staged: true }), expected);
});
