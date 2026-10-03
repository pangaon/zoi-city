import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
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
