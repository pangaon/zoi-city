#!/usr/bin/env node
/**
 * lint-html.mjs — zero-dependency HTML well-formedness / hygiene linter.
 *
 * For every *.html under the target directory, checks:
 *   1. exactly one <head> element (counted outside comments/scripts/styles)
 *   2. <meta name="viewport"> present
 *   3. <title> present
 *   4. no literal "TODO" / "FIXME" leaking into shipped markup (incl. comments/JS)
 *
 * Search-engine verification stubs (google<hex>.html) are exempt from 1-3
 * (they are single-line ownership tokens, not pages).
 *
 * Usage: node scripts/lint-html.mjs [targetDir]   (default: ".")
 * Exits 1 on any violation. Requires Node >= 18. No dependencies.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.vercel', '.next', 'dist']);
const VERIFICATION_STUB = /^google[0-9a-f]+\.html$/i;

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* htmlFiles(join(dir, entry.name));
    } else if (/\.html?$/i.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/** Remove comments and script/style bodies so structural tag counts are honest. */
function structuralView(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '<script></script>')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '<style></style>');
}

/** Lint one file's source. Returns an array of problem strings (empty = clean). */
export function lintHtml(html, { exemptStructure = false } = {}) {
  const problems = [];
  if (!exemptStructure) {
    const s = structuralView(html);
    const heads = (s.match(/<head(?=[\s>])/gi) || []).length;
    if (heads !== 1) problems.push(`expected exactly one <head>, found ${heads}`);
    if (!/<meta\b[^>]*\bname\s*=\s*["']?viewport["']?[^>]*>/i.test(s)) {
      problems.push('missing <meta name="viewport">');
    }
    if (!/<title\b[^>]*>/i.test(s)) problems.push('missing <title>');
  }
  const todoRe = /\b(TODO|FIXME)\b/g;
  let m;
  while ((m = todoRe.exec(html)) !== null) {
    const line = html.slice(0, m.index).split('\n').length;
    problems.push(`literal "${m[1]}" leaking (line ${line})`);
  }
  return problems;
}

function main() {
  const target = resolve(process.argv[2] || '.');
  let files = 0; let bad = 0;
  for (const file of htmlFiles(target)) {
    files++;
    const rel = relative(target, file) || file;
    const html = readFileSync(file, 'utf8');
    const problems = lintHtml(html, {
      exemptStructure: VERIFICATION_STUB.test(basename(file)),
    });
    if (problems.length) {
      bad++;
      console.error(`FAIL  ${rel}`);
      for (const p of problems) console.error(`      - ${p}`);
    }
  }
  if (files === 0) {
    console.error(`lint-html: no HTML files found under ${target}`);
    process.exit(2);
  }
  if (bad > 0) {
    console.error(`\nlint-html: ${bad} of ${files} HTML file(s) failed.`);
    process.exit(1);
  }
  console.log(`lint-html: OK — ${files} HTML file(s) passed.`);
}

// Run only when executed directly (tests import lintHtml without side effects).
if (process.argv[1] && /lint-html\.mjs$/.test(process.argv[1])) {
  main();
}
