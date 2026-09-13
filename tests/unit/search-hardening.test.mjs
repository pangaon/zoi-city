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

test('community feed does not render raw backend errors to visitors', () => {
  const html = read('community/index.html');
  assert.doesNotMatch(html, /Could not load the feed[\s\S]{0,160}esc\(e\.message\)/);
  assert.doesNotMatch(html, /color:var\(--red\)[^<]*['"]>['"]\+esc\(e\.message\)/);
  assert.match(html, /Community feed failed/);
});

test('mobile header constrains navigation and removes the secondary CTA', () => {
  const css = read('assets/zoi-theme.css');
  assert.match(css, /\.zoi-nav\{[^}]*flex:1;min-width:0[^}]*\}/);
  assert.match(css, /@media\(max-width:520px\)[\s\S]*?\.zoi-actions \.btn\{display:none\}/);
});

test('community feed migration removes the ambiguous scoped overload', () => {
  const sql = read('supabase/migrations/0020_feed_contract_hardening.sql');
  assert.match(sql, /DROP FUNCTION IF EXISTS public\.feed_list\(integer, integer, text, uuid, text\)/);
});

test('Vercel applies baseline browser security headers globally', () => {
  const cfg = JSON.parse(read('vercel.json'));
  const global = cfg.headers.find((entry) => entry.source === '/(.*)');
  assert.ok(global, 'global security header rule missing');
  const headers = Object.fromEntries(global.headers.map((h) => [h.key.toLowerCase(), h.value]));
  assert.equal(headers['x-content-type-options'], 'nosniff');
  assert.equal(headers['x-frame-options'], 'DENY');
  assert.equal(headers['referrer-policy'], 'strict-origin-when-cross-origin');
  assert.match(headers['permissions-policy'], /camera=\(\)/);
  assert.equal(headers['cross-origin-opener-policy'], 'same-origin-allow-popups');
  assert.equal(headers['cross-origin-resource-policy'], 'same-site');
  assert.match(headers['content-security-policy-report-only'], /default-src 'self'/);
  assert.match(headers['content-security-policy-report-only'], /frame-ancestors 'none'/);
});

test('Event OS SECURITY DEFINER functions pin an empty search_path', () => {
  const sql = read('supabase/migrations/0036_event_os_hardening.sql');
  const functions = sql.split('CREATE OR REPLACE FUNCTION public.').slice(1);
  assert.ok(functions.length >= 10, 'Event OS hardening functions are missing');
  for (const definition of functions) {
    if (/SECURITY DEFINER/.test(definition)) assert.match(definition, /SET search_path TO ''/);
  }
});
