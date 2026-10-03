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

export function scanTrackedFiles(root, { staged = false } = {}) {
  const names = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  for (const name of names) {
    let bytes;
    if (staged) bytes = execFileSync('git', ['show', `:${name}`], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
    else {
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
