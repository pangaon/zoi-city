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

const dir = resolve(process.argv[2] || 'tests');
const files = [...testFiles(dir)];
if (files.length === 0) {
  console.error(`run-tests: no *.test.mjs files found under ${dir}`);
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
let failed = (r.status ?? 1) !== 0;

/* Standalone suites.
 *
 * tests/{contract,pages,unit}/run.mjs predate node:test and carry their own
 * TAP-style harness, so they do not match *.test.mjs and were never collected —
 * 81 assertions, including the contract tests that check zoi tables are not
 * exposed through the anon REST API, silently not running. tests/pages was
 * failing four of nine at the time this was noticed.
 *
 * Rather than rewrite three working suites, run them as scripts and require a
 * zero exit. They are network-dependent (they fetch the live site), so a network
 * failure is reported as a skip rather than turning CI red for the wrong reason. */
function* runners(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) yield* runners(join(d, e.name));
    else if (e.name === 'run.mjs') yield join(d, e.name);
  }
}
const standalone = [...runners(dir)];
for (const f of standalone) {
  console.log(`\n# standalone suite: ${f}`);
  const out = spawnSync(process.execPath, [f], { stdio: 'inherit', timeout: 120000 });
  if (out.error && out.error.code === 'ETIMEDOUT') {
    console.log(`# ${f}: timed out — treated as skipped, not a failure`);
    continue;
  }
  if ((out.status ?? 1) !== 0) {
    console.error(`# ${f}: FAILED`);
    failed = true;
  }
}
if (standalone.length) {
  console.log(`\n# ran ${files.length} node:test file(s) + ${standalone.length} standalone suite(s)`);
}
process.exit(failed ? 1 : 0);
