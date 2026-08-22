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
process.exit(r.status ?? 1);
