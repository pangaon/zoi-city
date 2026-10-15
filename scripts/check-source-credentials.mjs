#!/usr/bin/env node
// Scan every tracked file, including source evidence. Never print token values.
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const patterns = [
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/g],
  ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b/g],
  ['AWS access key ID', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
  ['Stripe secret key', /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
];

export function credentialFindings(source) {
  const findings = [];
  for (const [type, pattern] of patterns) {
    for (const match of source.matchAll(pattern)) {
      findings.push({ type, line: source.slice(0, match.index).split('\n').length });
    }
  }
  return findings;
}

const BLOB_LIMIT = 64 * 1024 * 1024;
const BATCH_LIMIT = 32 * 1024 * 1024;
const INDEX_LIMIT = 32 * 1024 * 1024;
function gitBytes(root, args, input, maxBuffer) {
  // Replacement refs must never substitute other bytes for a staged object.
  try { return execFileSync('git', ['--no-replace-objects', ...args], { cwd: root, input, maxBuffer, stdio: 'pipe' }); }
  catch { throw Error('credential_git_read_failed'); }
}
function scanStagedFiles(root) {
  const index = gitBytes(root, ['ls-files', '--stage', '-z'], undefined, INDEX_LIMIT);
  if (index.length && index[index.length - 1] !== 0) throw Error('credential_index_framing');
  const entries = [], objects = new Map(), paths = new Set();
  for (const entry of index.toString('utf8').split('\0').filter(Boolean)) {
    const tab = entry.indexOf('\t'), header = entry.slice(0, tab);
    const match = /^([0-7]{6}) ([0-9a-f]{40}|[0-9a-f]{64}) ([0-3])$/.exec(header);
    if (tab < 0 || !match || !entry.slice(tab + 1)) throw Error('credential_index_framing');
    if (match[3] !== '0') throw Error('credential_index_unmerged');
    const name = entry.slice(tab + 1), oid = match[2];
    if (paths.has(name)) throw Error('credential_index_duplicate_path');
    paths.add(name); entries.push({ name, oid }); objects.set(oid, null);
  }
  if (!entries.length) return { files: 0, findings: [] };
  const ids = [...objects.keys()], input = ids.join('\n') + '\n';
  const sizes = gitBytes(root, ['cat-file', '--batch-check'], input, INDEX_LIMIT).toString('utf8');
  const lines = sizes.split('\n');
  if (lines.pop() !== '' || lines.length !== ids.length) throw Error('credential_object_framing');
  const metadata = lines.map((line, i) => {
    const m = /^([0-9a-f]{40}|[0-9a-f]{64}) blob (0|[1-9][0-9]*)$/.exec(line);
    if (!m || m[1] !== ids[i]) throw Error('credential_object_unavailable');
    const size = Number(m[2]);
    if (!Number.isSafeInteger(size) || size > BLOB_LIMIT) throw Error('credential_blob_size_limit');
    return { oid: ids[i], size, header: line + '\n', bytes: line.length + 1 + size + 1 };
  });
  function scanBatch(batch) {
    const expected = batch.reduce((sum, item) => sum + item.bytes, 0);
    const output = gitBytes(root, ['cat-file', '--batch'], batch.map(item => item.oid).join('\n') + '\n', expected);
    if (output.length !== expected) throw Error('credential_blob_framing');
    let offset = 0;
    for (const item of batch) {
      const header = Buffer.from(item.header, 'ascii');
      if (!output.subarray(offset, offset + header.length).equals(header)) throw Error('credential_blob_framing');
      offset += header.length;
      const bytes = output.subarray(offset, offset + item.size); offset += item.size;
      if (output[offset++] !== 10) throw Error('credential_blob_framing');
      objects.set(item.oid, credentialFindings(bytes.toString('utf8')));
    }
    if (offset !== output.length) throw Error('credential_blob_framing');
  }
  let batch = [], bytes = 0;
  for (const item of metadata) {
    if (batch.length && bytes + item.bytes > BATCH_LIMIT) { scanBatch(batch); batch = []; bytes = 0; }
    batch.push(item); bytes += item.bytes;
    if (bytes >= BATCH_LIMIT) { scanBatch(batch); batch = []; bytes = 0; }
  }
  if (batch.length) scanBatch(batch);
  const findings = [];
  for (const { name, oid } of entries) for (const finding of objects.get(oid)) findings.push({ path: name, ...finding });
  return { files: entries.length, findings };
}

export function scanTrackedFiles(root, { staged = false } = {}) {
  if (staged) return scanStagedFiles(root);
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  for (const name of names) {
    let bytes;
    {
      const path = resolve(root, name);
      let stat;
      try { stat = lstatSync(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      if (!stat.isFile()) continue;
      bytes = readFileSync(path);
    }
    for (const finding of credentialFindings(bytes.toString('utf8'))) findings.push({ path: name, ...finding });
  }
  return { files: names.length, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const staged = process.argv.includes('--staged');
  const root = resolve(process.argv.slice(2).find(arg => arg !== '--staged') || '.');
  const result = scanTrackedFiles(root, { staged });
  for (const finding of result.findings) console.error(`${finding.path}:${finding.line}: ${finding.type} signature (value withheld)`);
  console.log(`source-credentials: ${result.findings.length ? 'FAIL' : 'OK'} — ${result.files} tracked files; ${result.findings.length} findings`);
  if (result.findings.length) process.exitCode = 1;
}
