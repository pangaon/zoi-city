#!/usr/bin/env node
/**
 * run-tests.mjs — zero-dependency test runner.
 * Finds every *.test.mjs under tests/ and runs them with `node --test`.
 * (Avoids version-dependent behaviour of passing a directory to --test.)
 * Usage: node scripts/run-tests.mjs [testsDir]   (default: "tests")
 */
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function* testFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) yield* testFiles(join(dir, entry.name));
    else if (/\.test\.mjs$/.test(entry.name)) yield join(dir, entry.name);
  }
}

const args = process.argv.slice(2);
const mode = args.includes('--local') ? 'local' : args.includes('--live') ? 'live' : 'all';
if (args.includes('--local') && args.includes('--live')) {
  console.error('run-tests: choose --local or --live, not both');
  process.exit(2);
}
const dir = resolve(args.find(arg => !arg.startsWith('--')) || 'tests');
const timeout = Number(process.env.TEST_SUITE_TIMEOUT_MS || 120000);
if (!Number.isSafeInteger(timeout) || timeout <= 0) {
  console.error('run-tests: TEST_SUITE_TIMEOUT_MS must be a positive integer');
  process.exit(2);
}
console.log(`# verification mode: ${mode}; timeouts and unavailable services FAIL`);
const files = [...testFiles(dir)];
if (files.length === 0) {
  console.error(`run-tests: no *.test.mjs files found under ${dir}`);
  process.exit(2);
}
const r = mode === 'live' ? { status: 0 } : spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', timeout });
let failed = (r.status ?? 1) !== 0;
if (r.error) console.error(`# node:test: ${r.error.message}`);

// Standalone suites are required checks. A timeout is a failure, never a skip.
function* runners(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) yield* runners(join(d, e.name));
    else if (e.name === 'run.mjs') yield join(d, e.name);
  }
}
const standalone = [...runners(dir)].filter(file => {
  const network = /[\\/]tests[\\/](contract|pages)[\\/]/.test(file);
  return mode === 'all' || (mode === 'live' ? network : !file.includes('/contract/'));
});
for (const f of standalone) {
  console.log(`\n# standalone suite: ${f}`);
  const out = spawnSync(process.execPath, [f, ...(mode === 'local' && f.includes('/pages/') ? ['--local'] : [])], { stdio: 'inherit', timeout });
  if (out.error && out.error.code === 'ETIMEDOUT') {
    console.log(`# ${f}: FAILED: timed out`);
    failed = true;
    continue;
  }
  if ((out.status ?? 1) !== 0) {
    console.error(`# ${f}: FAILED`);
    failed = true;
  }
}
if (standalone.length) {
  console.log(`\n# ran ${mode === 'live' ? 0 : files.length} node:test file(s) + ${standalone.length} standalone suite(s)`);
}
process.exit(failed ? 1 : 0);
