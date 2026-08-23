/*!
 * email.js — Zoi Suite module: Email Campaigns (Mailchimp-grade composer)
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'email'.
 * mountEmail(root, ctx) renders the email suite into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * Features:
 *   - Campaign list with honest status chips: draft / scheduled / sent.
 *   - Composer: subject, preheader, from_name, body, audience_tag selector.
 *   - {{name}} merge tag with a live hint + preview substitution.
 *   - Save draft, schedule (datetime -> queue), unschedule, duplicate, delete.
 *
 * HONEST SENDING GATE:
 *   Actual delivery runs through an edge function that needs an email provider
 *   key (RESEND) which is NOT configured. There is therefore NO "send now".
 *   Campaigns SAVE and SCHEDULE (queue) only. We NEVER render a fake "sent"
 *   status of our own and NEVER fabricate opens/clicks/delivery. A campaign is
 *   only shown as "sent" if the backend itself reports sent_at.
 *
 * RPCs (all writes use auth:'require'):
 *   email_campaign_list(p_workspace) -> campaigns[]
 *   email_campaign_save(p_workspace,p_subject,p_body,p_preheader,p_from_name,p_audience_tag,p_id) -> {ok,id}
 *   email_campaign_schedule(p_workspace,p_id,p_at) ; email_campaign_unschedule(p_workspace,p_id)
 *   email_campaign_duplicate(p_workspace,p_id) ; email_campaign_delete(p_workspace,p_id)
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zm-styles';
  var VERSION = '1.0.0';

  /* Curated audience tags for the selector (backend p_audience_tag is free text). */
  var TAG_PRESETS = ['all', 'customers', 'leads', 'vips', 'namedays', 'newsletter', 'lapsed'];

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, cls, html) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }
  function noop() {}

  /* ---------- style injection (once per document) ---------- */
  function injectStyles(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    var css =
      '.zm-wrap{color:var(--tx);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
      '.zm-wrap *{box-sizing:border-box;}' +
      '.zm-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}' +
      '.zm-title{font-size:20px;font-weight:700;margin:0;}' +
      '.zm-count{color:var(--mut);font-size:13px;}' +
      '.zm-spacer{flex:1 1 auto;}' +
      '.zm-banner{display:flex;gap:10px;align-items:flex-start;background:var(--bg2);border:1px solid var(--line2);' +
        'border-left:3px solid var(--gold);border-radius:10px;padding:11px 13px;margin-bottom:16px;font-size:13px;color:var(--tx);}' +
      '.zm-banner svg{flex:0 0 auto;width:18px;height:18px;color:var(--gold);margin-top:1px;}' +
      '.zm-banner b{color:var(--gold);}' +
      '.zm-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:18px;align-items:start;}' +
      '@media(max-width:820px){.zm-grid{grid-template-columns:1fr;}}' +
      '.zm-panel{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px;}' +
      '.zm-panel h3{margin:0 0 10px;font-size:14px;font-weight:700;color:var(--tx);}' +
      '.zm-list{display:flex;flex-direction:column;gap:8px;max-height:560px;overflow:auto;}' +
      '.zm-item{background:var(--bg3);border:1px solid var(--line);border-radius:10px;padding:11px 12px;cursor:pointer;transition:border-color .15s,background .15s;}' +
      '.zm-item:hover{border-color:var(--line2);}' +
      '.zm-item.zm-on{border-color:var(--acc);background:var(--bg2);}' +
      '.zm-item-top{display:flex;align-items:center;gap:8px;margin-bottom:3px;}' +
      '.zm-subj{font-weight:600;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.zm-pre{color:var(--mut);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.zm-meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;color:var(--dim);font-size:11px;}' +
      '.zm-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;text-transform:capitalize;}' +
      '.zm-chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;}' +
      '.zm-chip.draft{color:var(--mut);background:var(--bg);border:1px solid var(--line2);}' +
      '.zm-chip.scheduled{color:var(--gold);background:rgba(212,175,55,.08);}' +
      '.zm-chip.sent{color:var(--green);background:rgba(46,160,90,.10);}' +
      '.zm-tag{display:inline-block;font-size:11px;color:var(--acc);background:rgba(120,150,255,.09);border:1px solid var(--line2);border-radius:999px;padding:1px 7px;}' +
      '.zm-field{margin-bottom:12px;}' +
      '.zm-field label{display:block;font-size:12px;font-weight:600;color:var(--mut);margin-bottom:4px;}' +
      '.zm-field .zm-hint{font-weight:400;color:var(--dim);}' +
      '.zm-input,.zm-ta,.zm-sel{width:100%;background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--tx);' +
        'padding:9px 10px;font:inherit;outline:none;}' +
      '.zm-input:focus,.zm-ta:focus,.zm-sel:focus{border-color:var(--acc);}' +
      '.zm-ta{min-height:170px;resize:vertical;font-family:inherit;line-height:1.55;}' +
      '.zm-row{display:flex;gap:10px;flex-wrap:wrap;}' +
      '.zm-row>.zm-field{flex:1 1 160px;margin-bottom:12px;}' +
      '.zm-tagrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}' +
      '.zm-charc{float:right;font-size:11px;color:var(--dim);font-weight:400;}' +
      '.zm-charc.warn{color:var(--gold);}' +
      '.zm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:14px;border-top:1px solid var(--line);}' +
      '.zm-btn{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid var(--line2);' +
        'background:var(--bg3);color:var(--tx);cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px;}' +
      '.zm-btn:hover{border-color:var(--acc);}' +
      '.zm-btn:disabled{opacity:.5;cursor:not-allowed;}' +
      '.zm-btn.pri{background:var(--acc);border-color:var(--acc);color:#fff;}' +
      '.zm-btn.pri:hover{filter:brightness(1.08);}' +
      '.zm-btn.gold{background:var(--gold);border-color:var(--gold);color:#1a1400;}' +
      '.zm-btn.danger{color:#ff8080;}' +
      '.zm-btn.danger:hover{border-color:#ff8080;}' +
      '.zm-btn.ghost{background:transparent;}' +
      '.zm-spacer2{flex:1 1 auto;}' +
      '.zm-prev{background:var(--bg);border:1px solid var(--line2);border-radius:10px;padding:0;overflow:hidden;margin-top:6px;}' +
      '.zm-prev-hd{padding:9px 12px;border-bottom:1px solid var(--line);font-size:12px;color:var(--mut);}' +
      '.zm-prev-hd b{color:var(--tx);}' +
      '.zm-prev-sub{padding:10px 12px 2px;font-weight:700;font-size:15px;}' +
      '.zm-prev-pre{padding:0 12px 10px;color:var(--mut);font-size:12px;}' +
      '.zm-prev-body{padding:12px;border-top:1px solid var(--line);white-space:pre-wrap;word-break:break-word;color:var(--tx);font-size:13px;line-height:1.6;}' +
      '.zm-prev-foot{padding:10px 12px;border-top:1px solid var(--line);color:var(--dim);font-size:11px;text-align:center;}' +
      '.zm-prev-foot a{color:var(--acc);text-decoration:underline;}' +
      '.zm-sched{display:none;margin-top:10px;gap:8px;align-items:flex-end;flex-wrap:wrap;}' +
      '.zm-sched.on{display:flex;}' +
      '.zm-sched .zm-field{margin:0;flex:1 1 200px;}' +
      '.zm-empty{color:var(--dim);text-align:center;padding:34px 12px;font-size:13px;}' +
      '.zm-loading{color:var(--mut);padding:20px;text-align:center;font-size:13px;}' +
      '.zm-mergehint{font-size:12px;color:var(--mut);background:var(--bg);border:1px dashed var(--line2);border-radius:8px;padding:8px 10px;margin-bottom:12px;}' +
      '.zm-mergehint code{background:var(--bg3);border:1px solid var(--line2);border-radius:4px;padding:1px 5px;color:var(--gold);font-size:11px;}';
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ---------- helpers ---------- */
  function statusOf(c) {
    if (c && c.sent_at) return 'sent';
    if (c && (c.status === 'scheduled' || c.scheduled_at)) return 'scheduled';
    return 'draft';
  }
  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  // ISO string suitable for <input type=datetime-local> value (local time, no seconds)
  function toLocalInput(d) {
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  // Substitute {{name}} in a preview only (server does the real merge at send).
  function mergePreview(text, name) {
    if (text == null) return '';
    return String(text).replace(/\{\{\s*name\s*\}\}/gi, name || 'friend');
  }

  /* ============================================================= */
  async function mountEmail(root, ctx) {
    ctx = ctx || {};
    var C = ctx.C || {};
    var esc = C.esc || function (v) { return String(v == null ? '' : v); };
    var toast = ctx.toast || C.toast || noop;
    var relTime = C.relTime || function () { return ''; };
    var ws = ctx.ws;
    var rpc = (C.api && C.api.rpc) ? C.api.rpc.bind(C.api) : null;

    injectStyles(document);

    var state = {
      campaigns: [],
      selectedId: null,   // id of campaign being edited, or null for a fresh draft
      loading: true,
      schedOpen: false
    };

    var wrap = el('div', 'zm-wrap');
    root.innerHTML = '';
    root.appendChild(wrap);

    function q(id) { return wrap.querySelector('[data-z="' + id + '"]'); }

    /* ---------- shell ---------- */
    function renderShell() {
      wrap.innerHTML =
        '<div class="zm-head">' +
          '<h2 class="zm-title">Email Campaigns</h2>' +
          '<span class="zm-count" data-z="count"></span>' +
          '<span class="zm-spacer"></span>' +
          '<button class="zm-btn pri" data-z="new">+ New campaign</button>' +
        '</div>' +
        '<div class="zm-banner">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
            '<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/></svg>' +
          '<div>Campaigns <b>save and schedule</b> now. Delivery turns on when Zoi’s email ' +
            'provider is connected — and every send will honor <b>consent + one-click unsubscribe (CASL)</b>.</div>' +
        '</div>' +
        '<div class="zm-grid">' +
          '<div class="zm-panel">' +
            '<h3>Campaigns</h3>' +
            '<div class="zm-list" data-z="list"><div class="zm-loading">Loading…</div></div>' +
          '</div>' +
          '<div class="zm-panel" data-z="composer"></div>' +
        '</div>';

      q('new').addEventListener('click', function () {
        state.selectedId = null;
        state.schedOpen = false;
        renderComposer();
        renderList();
      });
    }

    /* ---------- list ---------- */
    function renderList() {
      var list = q('list');
      if (!list) return;
      var cs = state.campaigns;
      q('count').textContent = cs.length + (cs.length === 1 ? ' campaign' : ' campaigns');
      if (state.loading) { list.innerHTML = '<div class="zm-loading">Loading…</div>'; return; }
      if (!cs.length) {
        list.innerHTML = '<div class="zm-empty">No campaigns yet.<br>Click “+ New campaign” to draft your first.</div>';
        return;
      }
      list.innerHTML = '';
      cs.forEach(function (c) {
        var st = statusOf(c);
        var item = el('div', 'zm-item' + (state.selectedId === c.id ? ' zm-on' : ''));
        var when = '';
        if (st === 'sent' && c.sent_at) when = 'Sent ' + fmtDateTime(c.sent_at);
        else if (st === 'scheduled' && c.scheduled_at) when = 'Scheduled ' + fmtDateTime(c.scheduled_at);
        else if (c.updated_at) when = 'Edited ' + (relTime(c.updated_at) || fmtDateTime(c.updated_at));
        var recips = (st === 'sent' && c.recipients != null)
          ? '<span>' + esc(String(c.recipients)) + ' recipients</span>' : '';
        item.innerHTML =
          '<div class="zm-item-top">' +
            '<span class="zm-subj">' + (esc(c.subject) || '<i style="color:var(--dim)">(no subject)</i>') + '</span>' +
            '<span class="zm-chip ' + st + '">' + st + '</span>' +
          '</div>' +
          (c.preheader ? '<div class="zm-pre">' + esc(c.preheader) + '</div>' : '') +
          '<div class="zm-meta">' +
            (c.audience_tag ? '<span class="zm-tag">' + esc(c.audience_tag) + '</span>' : '') +
            (when ? '<span>' + esc(when) + '</span>' : '') +
            recips +
          '</div>';
        item.addEventListener('click', function () {
          state.selectedId = c.id;
          state.schedOpen = false;
          renderComposer();
          renderList();
        });
        list.appendChild(item);
      });
    }

    function current() {
      if (state.selectedId == null) return null;
      for (var i = 0; i < state.campaigns.length; i++) {
        if (state.campaigns[i].id === state.selectedId) return state.campaigns[i];
      }
      return null;
    }

    /* ---------- composer ---------- */
    function renderComposer() {
      var host = q('composer');
      if (!host) return;
      var c = current() || {};
      var st = current() ? statusOf(c) : 'draft';
      var isSent = st === 'sent';
      var isScheduled = st === 'scheduled';
      var selTag = c.audience_tag || 'all';
      var tags = TAG_PRESETS.slice();
      if (c.audience_tag && tags.indexOf(c.audience_tag) === -1) tags.unshift(c.audience_tag);

      host.innerHTML =
        '<h3>' + (current() ? 'Edit campaign' : 'New campaign') +
          (current() ? ' <span class="zm-chip ' + st + '" style="float:right">' + st + '</span>' : '') + '</h3>' +
        (isSent ? '<div class="zm-mergehint">This campaign was reported <b>sent</b> by the backend. ' +
          'Fields are read-only; use <b>Duplicate</b> to reuse it.</div>' : '') +
        '<div class="zm-field">' +
          '<label>Subject <span class="zm-charc" data-z="c_subj"></span></label>' +
          '<input class="zm-input" data-z="subject" maxlength="150" placeholder="Your subject line" ' +
            'value="' + esc(c.subject) + '"' + (isSent ? ' disabled' : '') + '>' +
        '</div>' +
        '<div class="zm-field">' +
          '<label>Preheader <span class="zm-hint">(inbox preview text)</span> <span class="zm-charc" data-z="c_pre"></span></label>' +
          '<input class="zm-input" data-z="preheader" maxlength="150" placeholder="Short summary shown after the subject" ' +
            'value="' + esc(c.preheader) + '"' + (isSent ? ' disabled' : '') + '>' +
        '</div>' +
        '<div class="zm-row">' +
          '<div class="zm-field">' +
            '<label>From name</label>' +
            '<input class="zm-input" data-z="from_name" maxlength="80" placeholder="e.g. Maria at BuyGreek" ' +
              'value="' + esc(c.from_name) + '"' + (isSent ? ' disabled' : '') + '>' +
          '</div>' +
          '<div class="zm-field">' +
            '<label>Audience</label>' +
            '<select class="zm-sel" data-z="audience"' + (isSent ? ' disabled' : '') + '>' +
              tags.map(function (t) {
                return '<option value="' + esc(t) + '"' + (t === selTag ? ' selected' : '') + '>' + esc(t) + '</option>';
              }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="zm-mergehint">Personalize with the merge tag <code>{{name}}</code> — it becomes each ' +
          'contact’s name at send (falls back to “friend”). Preview below uses a sample name.</div>' +
        '<div class="zm-field">' +
          '<label>Body <span class="zm-charc" data-z="c_body"></span></label>' +
          '<textarea class="zm-ta" data-z="body" placeholder="Write your email… Hi {{name}}, ..."' +
            (isSent ? ' disabled' : '') + '>' + esc(c.body) + '</textarea>' +
        '</div>' +
        '<div class="zm-field">' +
          '<label>Live preview</label>' +
          '<div class="zm-prev">' +
            '<div class="zm-prev-hd"><b data-z="pv_from"></b> <span data-z="pv_pre"></span></div>' +
            '<div class="zm-prev-sub" data-z="pv_sub"></div>' +
            '<div class="zm-prev-pre" data-z="pv_pre2"></div>' +
            '<div class="zm-prev-body" data-z="pv_body"></div>' +
            '<div class="zm-prev-foot">You received this because you opted in. ' +
              '<a href="#" onclick="return false">Unsubscribe</a> — one click, honored (CASL).</div>' +
          '</div>' +
        '</div>' +
        (isSent ? '' :
          '<div class="zm-actions">' +
            '<button class="zm-btn pri" data-z="save">Save draft</button>' +
            (isScheduled
              ? '<button class="zm-btn ghost" data-z="unsched">Unschedule</button>'
              : '<button class="zm-btn gold" data-z="sched_toggle">Schedule…</button>') +
            (current() ? '<button class="zm-btn ghost" data-z="dup">Duplicate</button>' : '') +
            '<span class="zm-spacer2"></span>' +
            (current() ? '<button class="zm-btn danger ghost" data-z="del">Delete</button>' : '') +
          '</div>' +
          '<div class="zm-sched' + (state.schedOpen ? ' on' : '') + '" data-z="sched">' +
            '<div class="zm-field"><label>Send at (queued)</label>' +
              '<input class="zm-input" type="datetime-local" data-z="sched_at"></div>' +
            '<button class="zm-btn gold" data-z="sched_go">Queue it</button>' +
          '</div>');

      if (!isSent) wireComposer();
      updatePreview();
      updateCounts();
    }

    function updateCounts() {
      var pairs = [['subject', 'c_subj', 150], ['preheader', 'c_pre', 150]];
      pairs.forEach(function (p) {
        var inp = q(p[0]); var out = q(p[1]);
        if (!inp || !out) return;
        var n = inp.value.length;
        out.textContent = n + '/' + p[2];
        out.className = 'zm-charc' + (n > p[2] * 0.9 ? ' warn' : '');
      });
      var body = q('body'); var bc = q('c_body');
      if (body && bc) bc.textContent = body.value.length + ' chars';
    }

    function updatePreview() {
      var subj = q('subject') ? q('subject').value : '';
      var pre = q('preheader') ? q('preheader').value : '';
      var from = q('from_name') ? q('from_name').value : '';
      var body = q('body') ? q('body').value : '';
      var sample = 'Alexandra';
      if (q('pv_from')) q('pv_from').textContent = from || 'Your business';
      if (q('pv_pre')) q('pv_pre').textContent = '• to ' + (q('audience') ? q('audience').value : 'all');
      if (q('pv_sub')) q('pv_sub').textContent = mergePreview(subj, sample) || '(no subject)';
      if (q('pv_pre2')) q('pv_pre2').textContent = mergePreview(pre, sample);
      if (q('pv_body')) q('pv_body').textContent = mergePreview(body, sample) || '(empty body)';
    }

    function wireComposer() {
      ['subject', 'preheader', 'from_name', 'body'].forEach(function (id) {
        var inp = q(id);
        if (inp) inp.addEventListener('input', function () { updatePreview(); updateCounts(); });
      });
      var aud = q('audience');
      if (aud) aud.addEventListener('change', updatePreview);

      var saveBtn = q('save');
      if (saveBtn) saveBtn.addEventListener('click', function () { doSave(); });

      var st = q('sched_toggle');
      if (st) st.addEventListener('click', function () {
        state.schedOpen = !state.schedOpen;
        var sc = q('sched');
        if (sc) sc.classList.toggle('on', state.schedOpen);
        if (state.schedOpen && q('sched_at') && !q('sched_at').value) {
          var d = new Date(Date.now() + 60 * 60 * 1000);
          d.setSeconds(0, 0);
          q('sched_at').value = toLocalInput(d);
        }
      });
      var sg = q('sched_go');
      if (sg) sg.addEventListener('click', function () { doSchedule(); });
      var un = q('unsched');
      if (un) un.addEventListener('click', function () { doUnschedule(); });
      var dup = q('dup');
      if (dup) dup.addEventListener('click', function () { doDuplicate(); });
      var del = q('del');
      if (del) del.addEventListener('click', function () { doDelete(); });
    }

    /* ---------- validation ---------- */
    function collect() {
      return {
        subject: (q('subject') && q('subject').value || '').trim(),
        preheader: (q('preheader') && q('preheader').value || '').trim(),
        from_name: (q('from_name') && q('from_name').value || '').trim(),
        body: (q('body') && q('body').value || ''),
        audience: (q('audience') && q('audience').value || 'all')
      };
    }
    function validate(d) {
      if (!d.subject) { toast('Add a subject line first.', 'warn'); if (q('subject')) q('subject').focus(); return false; }
      if (!d.body.trim()) { toast('Write a body before saving.', 'warn'); if (q('body')) q('body').focus(); return false; }
      return true;
    }

    async function withBusy(btn, fn) {
      if (btn) btn.disabled = true;
      var prev = btn ? btn.textContent : '';
      if (btn) btn.textContent = '…';
      try { await fn(); }
      catch (e) { toast((e && e.message) ? e.message : 'Something went wrong.', 'error'); }
      finally { if (btn) { btn.disabled = false; btn.textContent = prev; } }
    }

    /* ---------- save (returns id for chaining) ---------- */
    async function saveCore() {
      var d = collect();
      if (!validate(d)) return null;
      if (!rpc) { toast('Not connected.', 'error'); return null; }
      var res = await rpc('email_campaign_save', {
        p_workspace: ws,
        p_subject: d.subject,
        p_body: d.body,
        p_preheader: d.preheader,
        p_from_name: d.from_name,
        p_audience_tag: d.audience,
        p_id: state.selectedId || null
      }, { auth: 'require' });
      var id = res && (res.id != null ? res.id : (res.ok ? state.selectedId : null));
      if (id != null) state.selectedId = id;
      await reload();
      return state.selectedId;
    }

    function doSave() {
      withBusy(q('save'), async function () {
        var id = await saveCore();
        if (id != null) { toast('Draft saved.', 'success'); renderComposer(); renderList(); }
      });
    }

    function doSchedule() {
      withBusy(q('sched_go'), async function () {
        var val = q('sched_at') ? q('sched_at').value : '';
        if (!val) { toast('Pick a date and time.', 'warn'); return; }
        var when = new Date(val);
        if (isNaN(when.getTime())) { toast('That date isn’t valid.', 'warn'); return; }
        if (when.getTime() < Date.now() - 60000) { toast('Pick a time in the future.', 'warn'); return; }
        var id = await saveCore();          // persist latest edits first
        if (id == null) return;
        await rpc('email_campaign_schedule', { p_workspace: ws, p_id: id, p_at: when.toISOString() }, { auth: 'require' });
        state.schedOpen = false;
        await reload();
        toast('Queued for ' + fmtDateTime(when.toISOString()) + '. It sends once the provider is connected.', 'success');
        renderComposer(); renderList();
      });
    }

    function doUnschedule() {
      withBusy(q('unsched'), async function () {
        if (!state.selectedId) return;
        await rpc('email_campaign_unschedule', { p_workspace: ws, p_id: state.selectedId }, { auth: 'require' });
        await reload();
        toast('Moved back to draft.', 'success');
        renderComposer(); renderList();
      });
    }

    function doDuplicate() {
      withBusy(q('dup'), async function () {
        if (!state.selectedId) return;
        var res = await rpc('email_campaign_duplicate', { p_workspace: ws, p_id: state.selectedId }, { auth: 'require' });
        await reload();
        if (res && res.id != null) state.selectedId = res.id;
        state.schedOpen = false;
        toast('Duplicated as a new draft.', 'success');
        renderComposer(); renderList();
      });
    }

    function doDelete() {
      if (!state.selectedId) return;
      if (!global.confirm('Delete this campaign? This cannot be undone.')) return;
      withBusy(q('del'), async function () {
        await rpc('email_campaign_delete', { p_workspace: ws, p_id: state.selectedId }, { auth: 'require' });
        state.selectedId = null;
        state.schedOpen = false;
        await reload();
        toast('Campaign deleted.', 'success');
        renderComposer(); renderList();
      });
    }

    /* ---------- data ---------- */
    async function reload() {
      if (!rpc) { state.campaigns = []; state.loading = false; return; }
      try {
        var rows = await rpc('email_campaign_list', { p_workspace: ws }, { auth: 'prefer' });
        state.campaigns = Array.isArray(rows) ? rows : (rows && rows.campaigns) || [];
      } catch (e) {
        state.campaigns = [];
        toast((e && e.message) ? e.message : 'Could not load campaigns.', 'error');
      }
      state.loading = false;
    }

    /* ---------- boot ---------- */
    renderShell();
    renderComposer();
    await reload();
    renderList();
    renderComposer();
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'email',
    label: 'Email',
    order: 50,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
    mount: mountEmail
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
