# Zoi Design System — the look every page must match

This is the zoi.city homepage look: **dark-first, Fraunces italic display, Hanken Grotesk UI, gold accent**, with light + gold theme variants. Apply it to EVERY page.

## Drop-in on every page
In `<head>`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="/assets/zoi-theme.css">
```
Set the theme attribute up front so there's no flash:
```html
<html lang="en" data-theme="dark">
```
Before `</body>`:
```html
<script src="/assets/zoi-theme.js"></script>
```
`zoi-theme.css` and `zoi-theme.js` are in this folder under `assets/` — they define ALL tokens, base type, components, and the dark/light/gold toggle. Do not fork the palette; use the CSS variables.

## Tokens (already in zoi-theme.css — reference only)
Dark: `--bg:#080a0e --bg2:#0e131a --card:#141a22 --tx:#f3f6fa --mut:#8b95a3 --gold:#d9b26a --acc:#6ea8ff`. Light and gold variants come from `[data-theme="light"]` / `[data-theme="gold"]`. Radius `--r:18px`. Max width `--maxw:1140px`.

## Rules
- Headlines/display: **Fraunces**, light weight, italic on the accent word, that word in `--gold` (like *runs* on the homepage). Use `<h1>… <em>word</em> …</h1>`.
- Everything else: **Hanken Grotesk**.
- Backgrounds use the radial gradient from `body` — don't set flat colors on `body`.
- Buttons: `.btn.btn-primary` (filled) and `.btn.btn-ghost` (outline). Never raw unstyled buttons.
- Cards: `.card` with a `.ico` icon tile (inline stroke SVG, `currentColor`). No icon fonts, no image icons.
- Inline SVGs only, `stroke="currentColor"`, `fill="none"`, `stroke-width:1.6`.
- **Honesty:** never render fake numbers, ratings, or seeded content. If a stat/metric isn't real data, omit it.
- Accessible: semantic HTML, `aria-label` on icon buttons, 44px min targets, visible focus.
- Responsive: single column under 860px; nav collapses under 720px.

## Component snippets

**Header**
```html
<header class="zoi-header"><div class="wrap zoi-bar">
  <a class="zoi-brand" href="/"><span class="zoi-seal">&#918;</span><b>Zoi</b></a>
  <nav class="zoi-nav">
    <a href="/social">Tools</a><a href="/explore">Directory</a>
    <a href="/community">Community</a><a href="/apps/">Apps</a>
  </nav>
  <button class="theme-btn" id="themeBtn" aria-label="Switch theme">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>
  </button>
</div></header>
```

**Hero**
```html
<section class="wrap" style="padding:66px 0 30px">
  <span class="eyebrow"><span class="dot"></span>ΖΩΗ — GREECE · CYPRUS · THE DIASPORA</span>
  <h1 style="margin-top:22px;max-width:15ch">The Greek world <em>runs</em> on Zoi.</h1>
  <p class="lede" style="margin-top:20px">One line of supporting copy in Hanken Grotesk.</p>
  <div style="display:flex;gap:12px;margin-top:28px;flex-wrap:wrap">
    <a class="btn btn-primary" href="/social">Start free
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
    <a class="btn btn-ghost" href="/explore">Explore the Greek world</a>
  </div>
</section>
```

**Card**
```html
<a class="card" href="/tickets">
  <span class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1 0 4H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4 2 2 0 0 1 0-4Z"/></svg></span>
  <h3>Tickets &amp; Events</h3>
  <p class="muted" style="margin:.4rem 0 0">Sell tickets, manage events, design seat maps.</p>
</a>
```

**Footer**
```html
<footer class="zoi-footer"><div class="wrap" style="display:flex;flex-wrap:wrap;gap:20px;justify-content:space-between;align-items:center">
  <span>&copy; <span id="yr">2026</span> Zoi · The home of the Greek world.</span>
  <nav style="display:flex;gap:18px"><a href="/">Home</a><a href="/social">Tools</a><a href="/explore">Directory</a><a href="/community">Community</a></nav>
</div></footer>
```
