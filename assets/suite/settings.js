/*!
 * settings.js — Zoi Suite module: Settings (workspace + AI voice + preferences)
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'settings'.
 * mount(root, ctx) renders the settings panel into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * RPCs used:
 *   workspace_rename(p_workspace, p_name)                                        (auth:'require')
 *   ai_profile_get(p_workspace) -> {business_name,about,tone,languages,sample}|null
 *   ai_profile_save(p_workspace, p_business, p_about, p_tone, p_languages, p_sample) (auth:'require')
 *
 * Theme preference is local-only: sets document.documentElement[data-theme] and
 * localStorage 'zoi_theme'. Account/billing settings live elsewhere (noted, not faked).
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zs-styles';
  var VERSION = '1.0.0';
  var THEME_KEY = 'zoi_theme';

  var TONES = ['Warm & friendly', 'Professional', 'Playful', 'Bold & punchy', 'Informative', 'Luxury / premium'];

  /* ---------- one-time style injection ---------- */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '.zs-wrap{color:var(--tx);font-family:"Hanken Grotesk",system-ui,sans-serif;font-size:14px}',
      '.zs-title{font-size:18px;font-weight:800;margin:0 0 2px}',
      '.zs-sub{color:var(--mut);font-size:12.5px;margin:0 0 18px;max-width:64ch;line-height:1.5}',
      '.zs-card{background:var(--bg2);border:1px solid var(--line);border-radius:13px;padding:17px;margin:0 0 15px}',
      '.zs-card h3{margin:0 0 3px;font-size:14.5px;font-weight:800}',
      '.zs-card .zs-hint{margin:0 0 14px;color:var(--mut);font-size:12px;line-height:1.5;max-width:66ch}',
      '.zs-field{display:flex;flex-direction:column;gap:6px;margin:0 0 13px}',
      '.zs-field:last-child{margin-bottom:0}',
      '.zs-field label{font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}',
      '.zs-field input,.zs-field textarea,.zs-field select{background:var(--bg3);border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:10px 12px;font:14px "Hanken Grotesk",system-ui,sans-serif;width:100%;box-sizing:border-box}',
      '.zs-field textarea{resize:vertical;min-height:74px;line-height:1.5}',
      '.zs-field input:focus,.zs-field textarea:focus,.zs-field select:focus{outline:none;border-color:var(--acc)}',
      '.zs-row{display:flex;gap:11px;align-items:flex-end;flex-wrap:wrap}',
      '.zs-row .zs-field{flex:1 1 220px;margin:0}',
      '.zs-grid2{display:grid;grid-template-columns:1fr 1fr;gap:13px}',
      '.zs-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin-top:4px}',
      '.zs-btn{border:1px solid var(--acc);background:var(--acc);color:#fff;border-radius:9px;padding:10px 17px;font:700 13px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;white-space:nowrap}',
      '.zs-btn:hover:not(:disabled){filter:brightness(1.08)}',
      '.zs-btn:disabled{opacity:.55;cursor:not-allowed}',
      '.zs-btn.zs-ghost{background:var(--bg3);border-color:var(--line);color:var(--tx)}',
      '.zs-btn.zs-ghost:hover:not(:disabled){border-color:var(--acc)}',
      '.zs-saved{color:var(--green);font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:5px;opacity:0;transition:opacity .2s}',
      '.zs-saved.on{opacity:1}',
      '.zs-saved svg{width:13px;height:13px}',
      /* theme toggle */
      '.zs-theme{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}',
      '.zs-theme-txt b{display:block;font-size:13.5px}',
      '.zs-theme-txt span{color:var(--mut);font-size:12px}',
      '.zs-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg3)}',
      '.zs-seg button{background:transparent;border:none;color:var(--mut);padding:9px 15px;font:700 12.5px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:7px}',
      '.zs-seg button svg{width:14px;height:14px}',
      '.zs-seg button.on{background:var(--acc);color:#fff}',
      '.zs-seg button:not(.on):hover{color:var(--tx)}',
      /* meta / workspace id */
      '.zs-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.zs-wsid{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--mut);background:var(--bg3);border:1px solid var(--line);border-radius:8px;padding:6px 10px;word-break:break-all}',
      '.zs-copy{background:var(--bg3);border:1px solid var(--line);color:var(--tx);border-radius:8px;padding:6px 11px;font:700 11.5px "Hanken Grotesk",system-ui,sans-serif;cursor:pointer;white-space:nowrap}',
      '.zs-copy:hover{border-color:var(--acc)}',
      '.zs-note{display:flex;gap:9px;align-items:flex-start;color:var(--mut);font-size:12px;line-height:1.5;margin-top:12px}',
      '.zs-note svg{width:14px;height:14px;flex:0 0 auto;margin-top:1px;color:var(--dim)}',
      '.zs-load{color:var(--mut);font-size:12.5px;padding:10px 0}',
      '@media (max-width:560px){.zs-grid2{grid-template-columns:1fr}}'
    ].join('\n');
    var tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = css;
    document.head.appendChild(tag);
  }

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>';
  var MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>';
  var SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  var INFO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>';

  function currentTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) { t = null; }
    if (t === 'light' || t === 'dark') return t;
    // fall back to whatever the document already declares, default dark
    var attr = document.documentElement.getAttribute('data-theme');
    return (attr === 'light') ? 'light' : 'dark';
  }
  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
  }

  /* ---------- main mount ---------- */
  async function mountSettings(root, ctx) {
    injectStyles();
    var C = ctx.C || {};
    var esc = (C.esc) ? C.esc : function (s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[m];
      });
    };
    var toast = ctx.toast || (C.toast) || function () {};

    root.innerHTML = '';
    var wrap = el('div', 'zs-wrap');
    root.appendChild(wrap);

    wrap.appendChild(el('div', 'zs-title', 'Settings'));
    wrap.appendChild(el('p', 'zs-sub',
      'Your workspace name, the AI voice Zoi writes in, and your app preferences.'));

    /* ===== 1) Workspace name ===== */
    var wsCard = el('div', 'zs-card');
    wsCard.appendChild(el('h3', null, 'Business name'));
    wsCard.appendChild(el('p', 'zs-hint', 'The name of the workspace / business. Shown across Zoi and used in some previews.'));
    var wsRow = el('div', 'zs-row');
    var wsField = el('div', 'zs-field');
    wsField.appendChild(el('label', null, 'Workspace name'));
    var wsInput = el('input');
    wsInput.type = 'text';
    wsInput.placeholder = 'e.g. BuyGreek Shop';
    wsInput.maxLength = 120;
    wsField.appendChild(wsInput);
    wsRow.appendChild(wsField);
    var wsBtn = el('button', 'zs-btn', 'Save name');
    wsBtn.type = 'button';
    wsRow.appendChild(wsBtn);
    var wsSaved = el('span', 'zs-saved', CHECK_SVG + 'Saved');
    wsRow.appendChild(wsSaved);
    wsCard.appendChild(wsRow);
    wrap.appendChild(wsCard);

    /* ===== 2) AI voice / brand profile ===== */
    var aiCard = el('div', 'zs-card');
    aiCard.appendChild(el('h3', null, 'AI voice & brand'));
    aiCard.appendChild(el('p', 'zs-hint', 'How Zoi’s AI should write for you. This guides captions, replies and drafts across the suite.'));
    var aiLoad = el('div', 'zs-load', 'Loading AI profile…');
    aiCard.appendChild(aiLoad);

    var aiBody = el('div');
    aiBody.style.display = 'none';

    var fBiz = el('div', 'zs-field');
    fBiz.appendChild(el('label', null, 'Business name (as the AI should say it)'));
    var inBiz = el('input'); inBiz.type = 'text'; inBiz.maxLength = 120; inBiz.placeholder = 'BuyGreek Shop';
    fBiz.appendChild(inBiz);
    aiBody.appendChild(fBiz);

    var fAbout = el('div', 'zs-field');
    fAbout.appendChild(el('label', null, 'About the business'));
    var inAbout = el('textarea'); inAbout.maxLength = 1200; inAbout.placeholder = 'What you sell, who you serve, what makes you different…';
    fAbout.appendChild(inAbout);
    aiBody.appendChild(fAbout);

    var grid2 = el('div', 'zs-grid2');
    var fTone = el('div', 'zs-field');
    fTone.appendChild(el('label', null, 'Tone'));
    var selTone = el('select');
    TONES.forEach(function (t) { var o = el('option'); o.value = t; o.textContent = t; selTone.appendChild(o); });
    fTone.appendChild(selTone);
    grid2.appendChild(fTone);
    var fLang = el('div', 'zs-field');
    fLang.appendChild(el('label', null, 'Languages'));
    var inLang = el('input'); inLang.type = 'text'; inLang.maxLength = 120; inLang.placeholder = 'English, Greek';
    fLang.appendChild(inLang);
    grid2.appendChild(fLang);
    aiBody.appendChild(grid2);

    var fSample = el('div', 'zs-field');
    fSample.appendChild(el('label', null, 'Sample of your voice (optional)'));
    var inSample = el('textarea'); inSample.maxLength = 1200; inSample.placeholder = 'Paste a caption or two that sound like you.';
    fSample.appendChild(inSample);
    aiBody.appendChild(fSample);

    var aiActions = el('div', 'zs-actions');
    var aiBtn = el('button', 'zs-btn', 'Save AI voice');
    aiBtn.type = 'button';
    aiActions.appendChild(aiBtn);
    var aiSaved = el('span', 'zs-saved', CHECK_SVG + 'Saved');
    aiActions.appendChild(aiSaved);
    aiBody.appendChild(aiActions);

    // Honest note when AI is not enabled for this workspace.
    if (ctx.avail && ctx.avail.ai === false) {
      aiBody.appendChild(el('div', 'zs-note', INFO_SVG +
        '<span>AI generation isn’t enabled on this workspace yet — you can still set your voice here so it’s ready when it turns on.</span>'));
    }

    aiCard.appendChild(aiBody);
    wrap.appendChild(aiCard);

    /* ===== 3) Appearance / theme ===== */
    var thCard = el('div', 'zs-card');
    thCard.appendChild(el('h3', null, 'Appearance'));
    thCard.appendChild(el('p', 'zs-hint', 'Theme preference is saved on this device.'));
    var thWrap = el('div', 'zs-theme');
    var thTxt = el('div', 'zs-theme-txt', '<b>Theme</b><span>Switch between dark and light.</span>');
    thWrap.appendChild(thTxt);
    var seg = el('div', 'zs-seg');
    var btnDark = el('button', null, MOON_SVG + 'Dark');
    var btnLight = el('button', null, SUN_SVG + 'Light');
    btnDark.type = 'button'; btnLight.type = 'button';
    seg.appendChild(btnDark);
    seg.appendChild(btnLight);
    thWrap.appendChild(seg);
    thCard.appendChild(thWrap);
    wrap.appendChild(thCard);

    function paintTheme() {
      var t = currentTheme();
      btnDark.classList.toggle('on', t === 'dark');
      btnLight.classList.toggle('on', t === 'light');
    }
    btnDark.addEventListener('click', function () { applyTheme('dark'); paintTheme(); toast('Dark theme on.'); });
    btnLight.addEventListener('click', function () { applyTheme('light'); paintTheme(); toast('Light theme on.'); });
    paintTheme();

    /* ===== 4) Workspace meta / where billing lives ===== */
    var metaCard = el('div', 'zs-card');
    metaCard.appendChild(el('h3', null, 'Workspace'));
    var metaRow = el('div', 'zs-meta');
    var wsid = el('div', 'zs-wsid', esc(ctx.ws || '—'));
    metaRow.appendChild(wsid);
    var copyBtn = el('button', 'zs-copy', 'Copy ID');
    copyBtn.type = 'button';
    metaRow.appendChild(copyBtn);
    metaCard.appendChild(metaRow);
    metaCard.appendChild(el('div', 'zs-note', INFO_SVG +
      '<span>Account, plan and billing settings live in your Zoi account area, not here.</span>'));
    wrap.appendChild(metaCard);

    copyBtn.addEventListener('click', function () {
      var id = String(ctx.ws || '');
      var done = function () { toast('Workspace ID copied.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(id).then(done, function () { toast('Copy failed — select the ID manually.'); });
      } else {
        try {
          var ta = document.createElement('textarea');
          ta.value = id; document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); document.body.removeChild(ta); done();
        } catch (e) { toast('Copy failed — select the ID manually.'); }
      }
    });

    /* ---------- save handlers ---------- */
    function flashSaved(node) {
      node.classList.add('on');
      setTimeout(function () { node.classList.remove('on'); }, 2200);
    }

    async function saveName() {
      var name = (wsInput.value || '').trim();
      if (!name) { toast('Enter a workspace name.'); wsInput.focus(); return; }
      wsBtn.disabled = true; wsBtn.textContent = 'Saving…';
      try {
        await C.api.rpc('workspace_rename', { p_workspace: ctx.ws, p_name: name }, { auth: 'require' });
        flashSaved(wsSaved);
        toast('Workspace renamed.');
      } catch (e) {
        toast('Could not rename: ' + (e && e.message ? e.message : 'unknown error'));
      }
      wsBtn.disabled = false; wsBtn.textContent = 'Save name';
    }

    async function saveAi() {
      aiBtn.disabled = true; aiBtn.textContent = 'Saving…';
      try {
        await C.api.rpc('ai_profile_save', {
          p_workspace: ctx.ws,
          p_business: (inBiz.value || '').trim(),
          p_about: (inAbout.value || '').trim(),
          p_tone: selTone.value,
          p_languages: (inLang.value || '').trim(),
          p_sample: (inSample.value || '').trim()
        }, { auth: 'require' });
        flashSaved(aiSaved);
        toast('AI voice saved.');
      } catch (e) {
        toast('Could not save AI voice: ' + (e && e.message ? e.message : 'unknown error'));
      }
      aiBtn.disabled = false; aiBtn.textContent = 'Save AI voice';
    }

    wsBtn.addEventListener('click', saveName);
    aiBtn.addEventListener('click', saveAi);
    wsInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveName(); } });

    /* ---------- load AI profile ---------- */
    function setTone(val) {
      if (!val) return;
      var found = false;
      for (var i = 0; i < selTone.options.length; i++) {
        if (selTone.options[i].value === val) { found = true; break; }
      }
      if (!found) {
        var o = el('option'); o.value = val; o.textContent = val;
        selTone.insertBefore(o, selTone.firstChild);
      }
      selTone.value = val;
    }

    try {
      var prof = await C.api.rpc('ai_profile_get', { p_workspace: ctx.ws }, { auth: 'prefer' });
      if (prof) {
        if (prof.business_name) { inBiz.value = prof.business_name; wsInput.value = prof.business_name; }
        if (prof.about) inAbout.value = prof.about;
        setTone(prof.tone);
        if (prof.languages) inLang.value = prof.languages;
        if (prof.sample) inSample.value = prof.sample;
      }
    } catch (e) {
      toast('Could not load AI profile: ' + (e && e.message ? e.message : 'unknown error'));
    }
    aiLoad.style.display = 'none';
    aiBody.style.display = '';
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'settings',
    label: 'Settings',
    order: 90,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>',
    mount: mountSettings
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
