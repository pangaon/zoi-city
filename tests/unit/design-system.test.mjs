// The design system is a global stylesheet, and every page adds its own inline
// <style>. A page that reuses a class name the design system already styles
// inherits rules it never asked for. This has bitten twice: `.field` boxed
// fourteen flex wrappers in /tickets, and `.chip` silently forced the map's
// category filters to ALL CAPS with a glow ring on each dot. Neither threw.
//
// So: any class a page styles must either be namespaced, or be a design-system
// class it is deliberately reusing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('../../', import.meta.url).pathname;
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const classesIn = (css) => new Set([...strip(css).matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));

const DS = classesIn(readFileSync(join(ROOT, 'assets/zoi-theme.css'), 'utf8'));

// Classes a page may legitimately restyle: the shared shell and the vendor map.
const SHARED = new Set(['zoi-header', 'zoi-bar', 'zoi-brand', 'zoi-seal', 'zoi-nav', 'zoi-search',
  'zoi-actions', 'zoi-globe', 'zoi-preview', 'wrap', 'btn', 'btn-primary', 'btn-ghost',
  'theme-btn', 'muted', 'mono', 'serif', 'card', 'grid', 'hero', 'foot', 'wide', 'static',
  // Shared typography names. The design system's only claim on these is
  // text-wrap, which is exactly the kind of thing that should be global.
  'hlead', 'hsub']);

function html(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'tests') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) html(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}

/* Collisions that predate this guard. Each one is a page restyling a class the
 * design system also styles, so it may be inheriting rules it never asked for.
 * They are recorded rather than ignored: the test below fails on any NEW
 * collision, and this list is the work item for clearing the old ones. Whether
 * a given entry actually changes rendering needs a real-browser check — a
 * grouped selector like `.btn svg, .x {}` looks like a collision to static
 * analysis without being one. */
const KNOWN = new Set([
  'apps/business-pro/index.html restyles .chip',
  'apps/business-pro/index.html restyles .dot',
  'apps/business-pro/index.html restyles .eyebrow',
  'apps/business-pro/index.html restyles .field',
  'apps/business-pro/index.html restyles .h1',
  'apps/command-center/index.html restyles .dot',
  'apps/event-os/index.html restyles .dot',
  'apps/event-os/index.html restyles .eyebrow',
  'apps/event-os/index.html restyles .field',
  'apps/index.html restyles .chip',
  'apps/index.html restyles .dot',
  'apps/index.html restyles .eyebrow',
  'apps/index.html restyles .ico',
  'apps/index.html restyles .lede',
  'apps/intelligence/index.html restyles .eyebrow',
  'apps/intelligence/index.html restyles .stat',
  'apps/tickets-studio/index.html restyles .dot',
  'apps/tickets-studio/index.html restyles .field',
  'community/index.html restyles .dot',
  'explore/app/index.html restyles .chip',
  'explore/app/index.html restyles .dim',
  'explore/app/index.html restyles .field',
  'explore/app/index.html restyles .gname',
  'explore/app/index.html restyles .ico',
  'social/index.html restyles .field',
  'tickets/index.html restyles .dot',
  'tickets/index.html restyles .eyebrow',
  'tickets/index.html restyles .field',
  'tickets/index.html restyles .stat'
]);

test('no page silently inherits design-system styling through a reused class name', () => {
  const offenders = [];
  for (const file of html(ROOT)) {
    const src = readFileSync(file, 'utf8');
    for (const [, css] of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const c of classesIn(css)) {
        if (c.startsWith('maplibregl') || SHARED.has(c)) continue;
        if (!DS.has(c)) continue;
        // Does the design system actually declare properties for it, or is it
        // only ever a descendant in some longer selector?
        const declares = new RegExp('(?:^|[,\\s>+~{}])\\.' + c + '(?![\\w-])[^{}]*\\{[^}]*[a-z-]+\\s*:', 'm')
          .test(strip(readFileSync(join(ROOT, 'assets/zoi-theme.css'), 'utf8')));
        if (!declares) continue;
        const entry = `${relative(ROOT, file)} restyles .${c}`;
        if (!KNOWN.has(entry)) offenders.push(entry);
      }
    }
  }
  assert.deepEqual([...new Set(offenders)].sort(), [],
    'NEW class collision with the design system. Namespace it (see the map page\'s m-* prefix), ' +
    'or add it to SHARED if the reuse is deliberate:\n  ' + offenders.join('\n  '));
});

test('the recorded collision baseline is still accurate', () => {
  // If a page gets cleaned up, its entry must come out of KNOWN, otherwise the
  // list rots into a permanent excuse.
  const live = new Set();
  const dsCss = strip(readFileSync(join(ROOT, 'assets/zoi-theme.css'), 'utf8'));
  for (const file of html(ROOT)) {
    const src = readFileSync(file, 'utf8');
    for (const [, css] of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
      for (const c of classesIn(css)) {
        if (c.startsWith('maplibregl') || SHARED.has(c) || !DS.has(c)) continue;
        if (new RegExp('(?:^|[,\\s>+~{}])\\.' + c + '(?![\\w-])[^{}]*\\{[^}]*[a-z-]+\\s*:', 'm').test(dsCss)) {
          live.add(`${relative(ROOT, file)} restyles .${c}`);
        }
      }
    }
  }
  const stale = [...KNOWN].filter((k) => !live.has(k));
  assert.deepEqual(stale, [], 'these baseline entries are fixed — remove them from KNOWN:\n  ' + stale.join('\n  '));
});

test('the hidden attribute is guarded globally', () => {
  // A class rule that sets any display value beats the UA default for [hidden],
  // leaving an invisible element on top of the page eating clicks. It made the
  // whole map unclickable once.
  const css = readFileSync(join(ROOT, 'assets/zoi-theme.css'), 'utf8');
  assert.match(css, /\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/,
    'zoi-theme.css must force [hidden] to display:none');
});

test('every page that styles the globe container also ships the loader', () => {
  for (const file of html(ROOT)) {
    const src = readFileSync(file, 'utf8');
    if (!src.includes('id="zoiGlobe"')) continue;
    assert.match(src, /assets\/zoi-globe\.js/, `${relative(ROOT, file)} has a globe container but no loader`);
    assert.match(src, /data-mirror=/, `${relative(ROOT, file)} globe must mirror real stats, not invent them`);
    // the gazetteer must never be asked to supply a count
    assert.ok(!/ZOI_CITIES\[\d+\]\[5\]/.test(src), 'the gazetteer has no count field to read');
  }
});
