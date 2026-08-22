#!/usr/bin/env node
/**
 * check-inline-js.mjs — zero-dependency inline <script> syntax checker.
 *
 * Extracts every inline <script> block from every *.html file under the target
 * directory and runs `node --check` on each block. Exits non-zero if any block
 * fails to parse. Blocks with a src= attribute or a non-JavaScript type
 * (application/ld+json, application/json, text/template, importmap, ...) are
 * skipped. type="module" blocks are checked as ESM (.mjs).
 *
 * Usage: node scripts/check-inline-js.mjs [targetDir]   (default: ".")
 * Requires Node >= 18. No dependencies.
 */
import {
  readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync,
} from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const SKIP_DIRS = new Set(['node_modules', '.git', '.github', '.vercel', '.next', 'dist']);
const JS_TYPES = /^(text\/javascript|application\/(x-)?javascript|application\/ecmascript)$/i;

function* htmlFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* htmlFiles(join(dir, entry.name));
    } else if (/\.html?$/i.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

/** Extract inline script blocks. Returns [{ code, line, isModule }]. */
export function extractScripts(html) {
  const blocks = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/i.test(attrs)) continue; // external script — not inline
    const t = attrs.match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const type = t ? (t[1] ?? t[2] ?? t[3] ?? '').trim() : '';
    const isModule = /^module$/i.test(type);
    if (type && !isModule && !JS_TYPES.test(type)) continue; // JSON-LD, templates, etc.
    if (!m[2].trim()) continue; // empty block
    const line = html.slice(0, m.index).split('\n').length;
    blocks.push({ code: m[2], line, isModule });
  }
  return blocks;
}

function main() {
  const target = resolve(process.argv[2] || '.');
  const tmp = mkdtempSync(join(tmpdir(), 'zoi-jscheck-'));
  let files = 0; let blocks = 0; let failures = 0;
  try {
    for (const file of htmlFiles(target)) {
      files++;
      const rel = relative(target, file) || file;
      const html = readFileSync(file, 'utf8');
      const scripts = extractScripts(html);
      scripts.forEach((s, i) => {
        blocks++;
        const tmpFile = join(tmp, `block-${files}-${i}.${s.isModule ? 'mjs' : 'js'}`);
        writeFileSync(tmpFile, s.code, 'utf8');
        const r = spawnSync(process.execPath, ['--check', tmpFile], { encoding: 'utf8' });
        if (r.status !== 0) {
          failures++;
          const detail = (r.stderr || r.stdout || 'unknown parse error')
            .replaceAll(tmpFile, `${rel} <script #${i + 1}>`);
          console.error(`FAIL  ${rel}  <script> block #${i + 1} (starts line ${s.line})`);
          console.error(detail.trim().split('\n').map((l) => '      ' + l).join('\n'));
        }
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  if (files === 0) {
    console.error(`check-inline-js: no HTML files found under ${target}`);
    process.exit(2);
  }
  if (failures > 0) {
    console.error(`\ncheck-inline-js: ${failures} failing block(s) across ${files} file(s).`);
    process.exit(1);
  }
  console.log(`check-inline-js: OK — ${blocks} inline script block(s) in ${files} HTML file(s) parsed cleanly.`);
}

// Run only when executed directly (tests import extractScripts without side effects).
if (process.argv[1] && /check-inline-js\.mjs$/.test(process.argv[1])) {
  main();
}
