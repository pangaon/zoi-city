import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf8');

test('latest migration removes the ambiguous explore_search overload', () => {
  const sql = read('supabase/migrations/0019_search_contract_hardening.sql');
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.explore_search\(\s*text, text, text, text, integer, integer, text, text\s*\)/);
  const signature = sql.match(/CREATE OR REPLACE FUNCTION public\.explore_search\(([\s\S]*?)\) RETURNS jsonb/);
  assert.ok(signature, 'canonical explore_search declaration is missing');
  assert.match(signature[1], /p_region text DEFAULT NULL/);
  assert.doesNotMatch(signature[1], /p_sort/i, 'the canonical function must not retain a defaulted sort overload');
});

test('directory does not render raw backend errors to visitors', () => {
  const html = read('explore/index.html');
  assert.doesNotMatch(html, /toast\(['"]Search failed:\s*['"]\s*\+\s*e\.message\)/);
  assert.match(html, /Directory temporarily unavailable/);
  assert.match(html, /Your search and filters have been kept/);
});

test('mobile header constrains navigation and removes the secondary CTA', () => {
  const css = read('assets/zoi-theme.css');
  assert.match(css, /\.zoi-nav\{[^}]*flex:1;min-width:0[^}]*\}/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.zoi-actions \.btn\{display:none\}/);
});
