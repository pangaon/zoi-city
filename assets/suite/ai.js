/*!
 * ai.js — Zoi Suite AI STUDIO module ("write my posts for me")
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'ai'.
 * mount(root, ctx) renders AI Studio into `root`.
 *   ctx = { C:ZoiCore, ws (uuid), channels, avail:{publish,email,ai,payments,claims}, toast }
 *
 * HONESTY CONTRACT (audited platform):
 *  - It NEVER fabricates AI copy locally. The only text shown as a "suggestion"
 *    is text that literally came back inside the ai-generate response body.
 *  - If ctx.avail.ai is false, generation is disabled with a clear message.
 *  - If the edge function is not configured (returns {available:false}),
 *    reports an honest "AI is connecting" state instead of inventing output.
 *  - All model output is escaped with C.esc before insertion (treated untrusted).
 *
 * REAL ai-generate contract (from _wave1/functions/ai-generate/index.ts):
 *   REQUEST  (POST /functions/v1/ai-generate, JSON):
 *     { workspace:<uuid>, action:'week'|'caption'|'reply', input:<string>, count:<number 1..14> }
 *     Auth: Authorization: Bearer <access token>; apikey: <anon>
 *   ACCESS: server calls ai_profile_get with the caller JWT; 403 {error:'no_access'} if not a member.
 *   RESPONSE:
 *     - not configured (no ANTHROPIC_API_KEY): { available:false, reason:'not_configured' }
 *     - error:  { error:<msg> }  (400/403/500/502)
 *     - success:{ available:true, result:<parsed> } where
 *         week    -> result = [ { day:'Mon', text:'...' }, ... ]
 *         caption -> result = { text:'...' }
 *         reply   -> result = { text:'...' }
 *         (fallback if the model didn't return JSON: result = { text:<raw> })
 *   The server derives the brand voice server-side from ai_profile_get
 *   (business_name/about/tone/languages/sample). The request body carries no
 *   tone field, so a chosen tone is passed as a plain-language hint inside
 *   `input` (which the model actually reads) — never faked into the output.
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zai-styles';
  var VERSION = '1.0.0';

  // The three actions the edge function actually implements.
  var ACTIONS = [
    { id: 'week',    label: 'A week of posts',   hint: 'Zoi drafts a full week of ready-to-schedule posts.' },
    { id: 'caption', label: 'Caption / rewrite', hint: 'Turn a rough idea into one polished caption.' },
    { id: 'reply',   label: 'Reply to a review', hint: 'Warm, professional public reply to a comment or review.' }
  ];
  var TONES = ['professional', 'friendly', 'playful', 'elegant'];
  var COUNTS = [3, 5, 7, 10, 14];

  /* ---------- helpers ---------- */
  function el(tag, cls, html) {
    var d = global.document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function nl2br(escaped) {
    return String(escaped == null ? '' : escaped).replace(/\r\n|\r|\n/g, '<br>');
  }
  function cap(s) { s = String(s || ''); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- styles ---------- */
  function injectStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css = [
      '.zai-wrap{font-family:"Hanken Grotesk",system-ui,sans-serif;color:var(--tx);display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:18px;align-items:start}',
      '@media(max-width:860px){.zai-wrap{grid-template-columns:1fr}}',
      '.zai-col{display:flex;flex-direction:column;gap:16px;min-width:0}',
      '.zai-card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;padding:16px}',
      '.zai-h{font-weight:800;font-size:15px;letter-spacing:.01em;margin:0 0 2px;display:flex;align-items:center;gap:8px}',
      '.zai-h svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;flex:none}',
      '.zai-sub{color:var(--mut);font-size:12px;margin:0 0 4px}',
      '.zai-lab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--mut);margin:0 0 6px;display:block}',
      '.zai-field{margin-top:14px}',
      '.zai-field:first-child{margin-top:0}',
      '.zai-in,.zai-sel,.zai-ta{width:100%;box-sizing:border-box;background:var(--bg);border:1px solid var(--line);border-radius:10px;color:var(--tx);font:400 14px "Hanken Grotesk",system-ui;padding:10px 12px}',
      '.zai-ta{min-height:84px;resize:vertical;line-height:1.5}',
      '.zai-in:focus,.zai-sel:focus,.zai-ta:focus{outline:none;border-color:var(--acc)}',
      '.zai-in:disabled,.zai-sel:disabled,.zai-ta:disabled{opacity:.5;cursor:not-allowed}',
      '.zai-types{display:flex;flex-direction:column;gap:8px}',
      '.zai-type{display:flex;align-items:flex-start;gap:10px;padding:11px 13px;border:1px solid var(--line);border-radius:12px;background:var(--bg3);cursor:pointer;transition:.15s}',
      '.zai-type:hover{border-color:var(--acc)}',
      '.zai-type.on{border-color:var(--acc);background:rgba(47,129,247,.10)}',
      '.zai-type.disabled{opacity:.5;cursor:not-allowed}',
      '.zai-type .zai-dot{width:16px;height:16px;border-radius:50%;border:2px solid var(--line2);flex:none;margin-top:2px}',
      '.zai-type.on .zai-dot{border-color:var(--acc);background:radial-gradient(circle,var(--acc) 0 5px,transparent 6px)}',
      '.zai-type b{font-size:13.5px;font-weight:800;display:block}',
      '.zai-type span{font-size:11.5px;color:var(--mut);display:block;margin-top:2px}',
      '.zai-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}',
      '.zai-btn{padding:11px 18px;border-radius:12px;border:1px solid var(--line);background:var(--bg3);color:var(--tx);font:800 13.5px "Hanken Grotesk";cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:8px}',
      '.zai-btn:hover{border-color:var(--acc)}',
      '.zai-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;width:100%;justify-content:center}',
      '.zai-btn.sm{padding:7px 12px;font-size:12px;border-radius:9px}',
      '.zai-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.zai-btn:disabled:hover{border-color:var(--line)}',
      '.zai-spin{width:15px;height:15px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:zai-rot .7s linear infinite;flex:none}',
      '@keyframes zai-rot{to{transform:rotate(360deg)}}',
      '.zai-voice{font-size:12px;color:var(--tx);background:var(--bg3);border:1px solid var(--line);border-radius:11px;padding:11px 13px;line-height:1.5}',
      '.zai-voice .zai-vt{font-weight:800;color:var(--gold);display:block;margin-bottom:4px}',
      '.zai-voice code{background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 6px;font-size:11px;color:var(--green)}',
      '.zai-voice .zai-hintlink{color:var(--acc);font-weight:700}',
      '.zai-gate{font-size:13px;color:var(--tx);background:rgba(199,154,59,.10);border:1px solid rgba(199,154,59,.35);border-radius:12px;padding:14px 15px;line-height:1.55;display:flex;gap:11px;align-items:flex-start}',
      '.zai-gate svg{width:20px;height:20px;stroke:var(--gold);fill:none;stroke-width:2;flex:none;margin-top:1px}',
      '.zai-gate b{color:var(--gold)}',
      '.zai-results{display:flex;flex-direction:column;gap:12px}',
      '.zai-empty{color:var(--mut);font-size:13px;text-align:center;padding:38px 16px;border:1px dashed var(--line);border-radius:14px;line-height:1.6}',
      '.zai-empty svg{width:34px;height:34px;stroke:var(--dim);fill:none;stroke-width:1.6;display:block;margin:0 auto 10px}',
      '.zai-err{color:#ffd7d1;background:rgba(192,57,43,.14);border:1px solid rgba(192,57,43,.45);border-radius:12px;padding:13px 15px;font-size:13px;line-height:1.5}',
      '.zai-err b{color:#ff9d90}',
      '.zai-loading{display:flex;flex-direction:column;gap:12px}',
      '.zai-skel{height:74px;border-radius:12px;background:linear-gradient(90deg,var(--bg3) 25%,var(--bg2) 37%,var(--bg3) 63%);background-size:400% 100%;animation:zai-sh 1.3s ease infinite;border:1px solid var(--line)}',
      '@keyframes zai-sh{0%{background-position:100% 0}100%{background-position:-100% 0}}',
      '.zai-sug{border:1px solid var(--line);border-radius:14px;background:var(--bg2);overflow:hidden}',
      '.zai-sug-h{display:flex;align-items:center;gap:8px;padding:9px 13px;border-bottom:1px solid var(--line);background:var(--bg3)}',
      '.zai-sug-tag{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--acc);background:rgba(47,129,247,.12);border-radius:20px;padding:3px 9px}',
      '.zai-sug-day{font-size:12.5px;font-weight:800;color:var(--tx)}',
      '.zai-sug-body{padding:13px;font-size:14px;line-height:1.55;white-space:normal;word-wrap:break-word;color:var(--tx)}',
      '.zai-sug-acts{display:flex;gap:8px;padding:0 13px 13px;flex-wrap:wrap}',
      '.zai-chip{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--gold);background:rgba(199,154,59,.12);border:1px solid rgba(199,154,59,.3);border-radius:20px;padding:3px 9px}',
      '.zai-src{font-size:11px;color:var(--dim);margin:2px 0 0;display:flex;align-items:center;gap:6px}',
      '.zai-src svg{width:12px;height:12px;stroke:var(--green);fill:none;stroke-width:2}'
    ].join('\n');
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ================= MOUNT ================= */
  async function mountAI(root, ctx) {
    var doc = root.ownerDocument || global.document;
    var C = ctx.C;
    var esc = C.esc;
    var toast = ctx.toast || (C && C.toast) || function () {};
    var aiOn = !!(ctx.avail && ctx.avail.ai);
    injectStyle(doc);

    var state = {
      action: 'week',
      tone: '',
      count: 7,
      profile: null,
      loading: false,
      busySave: {}   // per-suggestion save-in-flight guard
    };

    root.innerHTML = '';
    var wrap = el('div', 'zai-wrap');
    var left = el('div', 'zai-col');
    var right = el('div', 'zai-col');
    wrap.appendChild(left);
    wrap.appendChild(right);
    root.appendChild(wrap);

    /* ---------- LEFT: prompt panel ---------- */
    var panel = el('div', 'zai-card');
    panel.innerHTML =
      '<div class="zai-h">' +
        '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>' +
        'AI Studio</div>' +
      '<p class="zai-sub">Tell Zoi what you need. It writes on-brand drafts you can save straight to your posts.</p>';
    left.appendChild(panel);

    // gate banner (only when AI unavailable)
    var gate = el('div', 'zai-gate');
    gate.style.marginTop = '14px';
    gate.innerHTML =
      '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>' +
      '<div><b>AI drafting turns on when Zoi’s AI is connected.</b><br>' +
      'The controls below are ready — generation unlocks the moment your workspace has Zoi’s AI enabled. Nothing here is invented locally.</div>';
    if (!aiOn) panel.appendChild(gate);

    // output type
    var fType = el('div', 'zai-field');
    fType.innerHTML = '<span class="zai-lab">What do you want?</span>';
    var types = el('div', 'zai-types');
    fType.appendChild(types);
    panel.appendChild(fType);

    function renderTypes() {
      types.innerHTML = '';
      ACTIONS.forEach(function (a) {
        var t = el('div', 'zai-type' + (state.action === a.id ? ' on' : '') + (aiOn ? '' : ' disabled'));
        t.innerHTML = '<span class="zai-dot"></span><div><b>' + esc(a.label) + '</b><span>' + esc(a.hint) + '</span></div>';
        if (aiOn) t.addEventListener('click', function () { state.action = a.id; renderTypes(); syncFields(); });
        types.appendChild(t);
      });
    }

    // topic / source field (label is contextual)
    var fTopic = el('div', 'zai-field');
    fTopic.innerHTML =
      '<span class="zai-lab" data-role="topiclab">Topic / goal</span>' +
      '<textarea class="zai-ta" data-role="topic"></textarea>';
    panel.appendChild(fTopic);

    // promoting
    var fPromo = el('div', 'zai-field');
    fPromo.innerHTML =
      '<span class="zai-lab">What are you promoting? <span style="text-transform:none;font-weight:600;color:var(--dim)">(optional)</span></span>' +
      '<input class="zai-in" type="text" data-role="promo" placeholder="e.g. cold-pressed olive oil, a nameday offer, new opening hours">';
    panel.appendChild(fPromo);

    // tone + count
    var fMeta = el('div', 'zai-field');
    fMeta.innerHTML =
      '<div class="zai-row">' +
        '<div style="flex:1;min-width:130px"><span class="zai-lab">Tone</span>' +
          '<select class="zai-sel" data-role="tone">' +
            TONES.map(function (t) { return '<option value="' + esc(t) + '">' + esc(cap(t)) + '</option>'; }).join('') +
          '</select></div>' +
        '<div data-role="countwrap" style="flex:1;min-width:120px"><span class="zai-lab">How many posts</span>' +
          '<select class="zai-sel" data-role="count">' +
            COUNTS.map(function (n) { return '<option value="' + n + '"' + (n === 7 ? ' selected' : '') + '>' + n + ' posts</option>'; }).join('') +
          '</select></div>' +
      '</div>';
    panel.appendChild(fMeta);

    // generate
    var fGo = el('div', 'zai-field');
    var goBtn = el('button', 'zai-btn pri');
    goBtn.setAttribute('data-role', 'go');
    goBtn.textContent = 'Generate';
    fGo.appendChild(goBtn);
    panel.appendChild(fGo);

    /* ---------- LEFT: brand voice note ---------- */
    var voice = el('div', 'zai-card');
    voice.innerHTML = '<div class="zai-voice" data-role="voice"><span class="zai-vt">Brand voice</span>Loading your saved brand profile…</div>';
    left.appendChild(voice);

    /* ---------- RIGHT: results ---------- */
    var out = el('div', 'zai-card');
    out.innerHTML = '<div class="zai-h">Drafts</div><p class="zai-sub">Only text returned by Zoi’s AI appears here — copy it or save it as a draft.</p>';
    var results = el('div', 'zai-results');
    results.style.marginTop = '14px';
    out.appendChild(results);
    right.appendChild(out);

    /* ---------- query helper ---------- */
    function q(role) { return root.querySelector('[data-role="' + role + '"]'); }

    /* ---------- field sync per action ---------- */
    function syncFields() {
      var a = state.action;
      var lab = q('topiclab');
      var ta = q('topic');
      var countWrap = q('countwrap');
      if (a === 'week') {
        lab.textContent = 'What’s happening this week? / theme';
        ta.placeholder = 'e.g. a new olive-oil batch arrives, Sunday market, Agios Dimitrios nameday shout-out';
        fPromo.style.display = '';
        countWrap.style.display = '';
      } else if (a === 'caption') {
        lab.textContent = 'Rough idea to turn into a caption';
        ta.placeholder = 'e.g. photo of fresh loaves out of the oven this morning, want it warm and inviting';
        fPromo.style.display = '';
        countWrap.style.display = 'none';
      } else { // reply
        lab.textContent = 'Paste the review or comment to reply to';
        ta.placeholder = 'e.g. “Lovely bakery but the queue was long on Saturday.”';
        fPromo.style.display = 'none';
        countWrap.style.display = 'none';
      }
    }

    /* ---------- build the `input` string sent to the model ---------- */
    function buildInput() {
      var topic = String(q('topic').value || '').trim();
      var promo = String(q('promo').value || '').trim();
      var tone = state.tone || '';
      var parts = [];
      if (state.action === 'reply') {
        // topic IS the review text; tone hint still helps.
        parts.push(topic);
        if (tone) parts.push('(Preferred tone for this reply: ' + tone + '.)');
      } else {
        if (topic) parts.push(topic);
        if (promo) parts.push('Currently promoting: ' + promo + '.');
        if (tone) parts.push('Preferred tone for this piece: ' + tone + '.');
      }
      return parts.join(' ').trim();
    }

    /* ---------- brand voice note ---------- */
    function renderVoice() {
      var box = q('voice');
      var p = state.profile;
      var settingsHint = ' <a class="zai-hintlink" href="#settings" data-role="tosettings">Improve it in Settings →</a>';
      if (!p || !(p.business_name || p.about || p.tone || p.sample)) {
        box.innerHTML = '<span class="zai-vt">Brand voice</span>' +
          'No brand profile saved yet, so drafts use a general Greek-business voice. Add your business name, an "about" line and a tone in Settings for on-brand copy.' + settingsHint;
        return;
      }
      var used = [];
      if (p.business_name) used.push('business name');
      if (p.about) used.push('about');
      if (p.tone) used.push('saved tone (<code>' + esc(p.tone) + '</code>)');
      if (p.languages) used.push('languages (<code>' + esc(p.languages) + '</code>)');
      if (p.sample) used.push('a writing sample');
      box.innerHTML = '<span class="zai-vt">Brand voice in use</span>' +
        'Zoi writes as <b>' + esc(p.business_name || 'your business') + '</b> using: ' + used.join(', ') + '. ' +
        'This voice is applied on the server from your saved profile.' + settingsHint;
    }

    /* ---------- results rendering ---------- */
    function showEmpty() {
      results.innerHTML =
        '<div class="zai-empty">' +
          '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>' +
          (aiOn
            ? 'Fill in what you need and hit <b>Generate</b>.<br>Zoi’s drafts will show up here.'
            : 'AI drafting turns on when Zoi’s AI is connected to this workspace.') +
        '</div>';
    }
    function showLoading() {
      var n = state.action === 'week' ? Math.min(state.count, 5) : 1;
      var h = '<div class="zai-loading">';
      for (var i = 0; i < n; i++) h += '<div class="zai-skel"></div>';
      h += '</div>';
      results.innerHTML = h;
    }
    function showError(msg) {
      results.innerHTML = '<div class="zai-err"><b>Couldn’t generate.</b><br>' + esc(msg) + '</div>';
    }
    function showNotConfigured() {
      results.innerHTML =
        '<div class="zai-err"><b>Zoi’s AI isn’t connected yet.</b><br>' +
        'The workspace reached the AI service but it has no model key configured, so there is nothing to draft with. ' +
        'This turns on once Zoi’s AI is enabled — no placeholder copy is shown in the meantime.</div>';
    }

    // Normalize the response `result` into [{ label, text }] using ONLY returned text.
    function normalize(result) {
      var list = [];
      if (Array.isArray(result)) {
        result.forEach(function (item) {
          if (item && typeof item === 'object') {
            var txt = item.text != null ? String(item.text) : '';
            if (txt.trim()) list.push({ label: item.day ? String(item.day) : '', text: txt });
          } else if (typeof item === 'string' && item.trim()) {
            list.push({ label: '', text: item });
          }
        });
      } else if (result && typeof result === 'object') {
        if (result.text != null && String(result.text).trim()) list.push({ label: '', text: String(result.text) });
      } else if (typeof result === 'string' && result.trim()) {
        list.push({ label: '', text: result });
      }
      return list;
    }

    function renderSuggestions(list) {
      results.innerHTML = '';
      if (!list.length) {
        showError('Zoi’s AI replied but returned no usable text. Try rephrasing your topic and generate again.');
        return;
      }
      list.forEach(function (item, i) {
        var card = el('div', 'zai-sug');
        var tag = state.action === 'week' ? 'Post' : (state.action === 'caption' ? 'Caption' : 'Reply');
        var head = '<div class="zai-sug-h"><span class="zai-sug-tag">' + esc(tag) + '</span>' +
          (item.label ? '<span class="zai-sug-day">' + esc(item.label) + '</span>' : '') + '</div>';
        // AI text is escaped, then newlines -> <br>. Treated as untrusted.
        card.innerHTML = head +
          '<div class="zai-sug-body">' + nl2br(esc(item.text)) + '</div>' +
          '<div class="zai-sug-acts">' +
            '<button class="zai-btn sm" data-act="copy">Copy</button>' +
            '<button class="zai-btn sm" data-act="save">Save as draft</button>' +
            '<span class="zai-src"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>from Zoi’s AI</span>' +
          '</div>';
        var rawText = item.text; // keep raw for copy/save (not re-parsed from DOM)
        card.querySelector('[data-act="copy"]').addEventListener('click', function () {
          copyText(rawText);
        });
        var saveBtn = card.querySelector('[data-act="save"]');
        saveBtn.addEventListener('click', function () {
          saveDraft(rawText, i, saveBtn);
        });
        results.appendChild(card);
      });
    }

    /* ---------- copy ---------- */
    function copyText(text) {
      var okMsg = 'Copied to clipboard.';
      try {
        if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
          global.navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallbackCopy);
          return;
        }
      } catch (e) { /* fall through */ }
      fallbackCopy();
      function fallbackCopy() {
        try {
          var ta = doc.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          doc.body.appendChild(ta);
          ta.focus(); ta.select();
          var ok = doc.execCommand && doc.execCommand('copy');
          doc.body.removeChild(ta);
          toast(ok ? okMsg : 'Select the text to copy it.');
        } catch (e2) { toast('Select the text to copy it.'); }
      }
    }

    /* ---------- save as draft ---------- */
    async function saveDraft(text, idx, btn) {
      if (state.busySave[idx]) return;
      state.busySave[idx] = true;
      var prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        var res = await C.api.rpc('social_save_post', {
          p_workspace: ctx.ws,
          p_body: text,
          p_channels: [],
          p_scheduled_at: null,
          p_status: 'draft',
          p_media: '[]',
          p_nameday: null,
          p_meta: { source: 'ai-studio', action: state.action, ai_generated: true },
          p_id: null
        }, { auth: 'require' });
        void res;
        toast('Saved to your drafts.');
        btn.textContent = 'Saved ✓';
        setTimeout(function () { if (btn) { btn.textContent = prev; btn.disabled = false; } }, 1600);
      } catch (e) {
        toast((e && e.message) || 'Could not save the draft.');
        btn.textContent = prev;
        btn.disabled = false;
      } finally {
        state.busySave[idx] = false;
      }
    }

    /* ---------- token ---------- */
    async function freshToken() {
      var t = (C.auth && typeof C.auth.token === 'function') ? C.auth.token() : null;
      if (C.auth && typeof C.auth.ensureFresh === 'function') {
        try { await C.auth.ensureFresh(); t = C.auth.token(); }
        catch (e) { /* keep whatever token we had; backend gates honestly */ }
      }
      return t;
    }

    /* ---------- generate (the honest core) ---------- */
    async function generate() {
      if (!aiOn) { toast('AI drafting turns on when Zoi’s AI is connected.'); return; }
      if (state.loading) return;

      var input = buildInput();
      if (state.action === 'reply' && !input) { toast('Paste the review or comment you want to reply to.'); return; }
      if (state.action !== 'reply' && !input) { toast('Add a topic or what you’re promoting first.'); return; }

      state.loading = true;
      setGenBusy(true);
      showLoading();

      var body = { workspace: ctx.ws, action: state.action, input: input };
      if (state.action === 'week') body.count = state.count;

      try {
        var token = await freshToken();
        var resp = await global.fetch(C.BASE + '/functions/v1/ai-generate', {
          method: 'POST',
          headers: {
            apikey: C.KEY,
            Authorization: 'Bearer ' + (token || ''),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        var data = null, rawText = '';
        try { rawText = await resp.text(); } catch (e) { rawText = ''; }
        if (rawText) { try { data = JSON.parse(rawText); } catch (e) { data = null; } }

        if (!resp.ok) {
          var em = (data && data.error) ? data.error : ('The AI service returned an error (HTTP ' + resp.status + ').');
          if (resp.status === 403 || (data && data.error === 'no_access')) {
            em = 'You don’t have access to this workspace’s AI, or your session expired. Sign in again and retry.';
          }
          showError(em);
          return;
        }
        if (!data) { showError('The AI service sent an unreadable response. Please try again.'); return; }

        // Backend says the model isn't configured — do NOT invent anything.
        if (data.available === false) { showNotConfigured(); return; }
        if (data.error) { showError(String(data.error)); return; }

        renderSuggestions(normalize(data.result));
      } catch (e) {
        showError('Couldn’t reach Zoi’s AI service. Check your connection and try again.');
      } finally {
        state.loading = false;
        setGenBusy(false);
      }
    }

    function setGenBusy(busy) {
      var btn = q('go');
      if (!btn) return;
      if (busy) {
        btn.disabled = true;
        btn.innerHTML = '<span class="zai-spin"></span> Zoi is writing…';
      } else {
        btn.disabled = !aiOn;
        btn.textContent = 'Generate';
      }
    }

    /* ---------- wire events ---------- */
    q('tone').addEventListener('change', function () { state.tone = this.value; });
    q('count').addEventListener('change', function () { state.count = Number(this.value) || 7; });
    goBtn.addEventListener('click', generate);
    // brand-voice "Settings" hint is a non-navigating pointer for the shell.
    right.parentNode.addEventListener('click', function (ev) {
      var a = ev.target;
      if (a && a.getAttribute && a.getAttribute('data-role') === 'tosettings') {
        ev.preventDefault();
        toast('Open the Settings tab to update your brand voice.');
      }
    });

    /* ---------- initial render ---------- */
    renderTypes();
    syncFields();
    renderVoice();
    showEmpty();
    if (!aiOn) {
      goBtn.disabled = true;
      ['topic', 'promo', 'tone', 'count'].forEach(function (r) { var n = q(r); if (n) n.disabled = true; });
    }

    /* ---------- load brand profile to prefill ---------- */
    try {
      var prof = await C.api.rpc('ai_profile_get', { p_workspace: ctx.ws }, { auth: 'require' });
      if (prof && typeof prof === 'object') {
        state.profile = prof;
        if (prof.tone) {
          var tl = String(prof.tone).toLowerCase().trim();
          if (TONES.indexOf(tl) === -1) TONES.push(tl); // honor a custom saved tone
          state.tone = tl;
          var sel = q('tone');
          if (sel) {
            if (!Array.prototype.some.call(sel.options, function (o) { return o.value === tl; })) {
              var opt = doc.createElement('option'); opt.value = tl; opt.textContent = cap(tl); sel.appendChild(opt);
            }
            sel.value = tl;
          }
        } else {
          state.tone = q('tone') ? q('tone').value : TONES[0];
        }
        renderVoice();
      }
    } catch (e) {
      // profile is optional; leave the default note.
      state.tone = q('tone') ? q('tone').value : TONES[0];
    }
    if (!state.tone) state.tone = q('tone') ? q('tone').value : TONES[0];
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'ai',
    label: 'AI Studio',
    order: 45,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>',
    mount: mountAI
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
