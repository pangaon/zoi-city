/*!
 * audience.js — Zoi Suite module: Audience / Contacts (lightweight CRM)
 * Classic script (NO ES modules). Self-contained. Zero external deps.
 *
 * Registers into window.ZoiSuite.modules with id 'audience'.
 * mountAudience(root, ctx) renders the CRM into `root`.
 *   ctx = { C:ZoiCore, ws, channels:[], avail:{publish,email,ai,payments,claims}, toast }
 *
 * Features:
 *   - Searchable / tag-filterable contacts table (search -> p_q, tag -> p_tag).
 *   - Add / edit contact form (tags via comma input -> text[]).
 *   - Delete with confirm.
 *   - CSV import: paste or file, columns name,email,phone,tags(pipe-separated),
 *     nameday,notes -> parse client-side -> preview -> audience_import -> report N.
 *   - Export current list to CSV via a client-side Blob.
 *   - Tag chips, live contact count.
 *   - Honest consent note near import (no scraping, opt-in only).
 *
 * RPCs (all writes use auth:'require'):
 *   audience_access(p_workspace) -> authoritative read/write capabilities
 *   audience_list(p_workspace,p_q,p_tag) -> contacts[]
 *   audience_upsert(p_workspace,p_name,p_email,p_phone,p_nameday,p_tags,p_notes,p_id) -> UUID
 *   audience_delete(p_workspace,p_id)
 *   audience_import(p_workspace,p_rows) -> summary  (p_rows = jsonb array of {name,email,phone,tags,...})
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'zu-styles';
  var VERSION = '1.0.0';

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
      '.zu-wrap{color:var(--tx);font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;}' +
      '.zu-wrap *{box-sizing:border-box;}' +
      '.zu-head{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}' +
      '.zu-title{font-size:20px;font-weight:700;margin:0;}' +
      '.zu-count{color:var(--mut);font-size:13px;}' +
      '.zu-spacer{flex:1 1 auto;}' +
      '.zu-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px;}' +
      '.zu-search{flex:1 1 200px;min-width:160px;}' +
      '.zu-input,.zu-ta,.zu-sel{width:100%;background:var(--bg);border:1px solid var(--line2);border-radius:8px;color:var(--tx);' +
        'padding:9px 10px;font:inherit;outline:none;}' +
      '.zu-input:focus,.zu-ta:focus,.zu-sel:focus{border-color:var(--acc);}' +
      '.zu-sel{max-width:210px;}' +
      '.zu-ta{min-height:96px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}' +
      '.zu-btn{font:inherit;font-size:13px;font-weight:600;padding:8px 14px;border-radius:8px;border:1px solid var(--line2);' +
        'background:var(--card2);color:var(--tx);cursor:pointer;transition:.15s;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;}' +
      '.zu-btn:hover{border-color:var(--acc);}' +
      '.zu-btn:disabled{opacity:.5;cursor:not-allowed;}' +
      '.zu-btn.pri{background:var(--btn-bg);border-color:var(--btn-bg);color:var(--btn-fg);}' +
      '.zu-btn.pri:hover{filter:brightness(1.08);}' +
      '.zu-btn.gold{background:var(--gold);border-color:var(--gold);color:#1a1400;}' +
      '.zu-btn.ghost{background:transparent;}' +
      '.zu-btn.danger{color:#ff8080;}' +
      '.zu-btn.danger:hover{border-color:#ff8080;}' +
      '.zu-btn.sm{padding:5px 9px;font-size:12px;}' +
      '.zu-panel{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:14px;margin-bottom:14px;}' +
      '.zu-tablewrap{background:var(--bg2);border:1px solid var(--line);border-radius:12px;overflow:auto;}' +
      '.zu-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px;}' +
      '.zu-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--mut);' +
        'padding:10px 12px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--bg2);}' +
      '.zu-table td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;}' +
      '.zu-table tr:last-child td{border-bottom:none;}' +
      '.zu-table tr:hover td{background:var(--card2);}' +
      '.zu-name{font-weight:600;}' +
      '.zu-sub{color:var(--mut);font-size:12px;}' +
      '.zu-chips{display:flex;gap:5px;flex-wrap:wrap;}' +
      '.zu-chip{display:inline-block;font-size:11px;color:var(--acc);background:rgba(120,150,255,.09);' +
        'border:1px solid var(--line2);border-radius:999px;padding:1px 8px;}' +
      '.zu-rowacts{display:flex;gap:6px;justify-content:flex-end;}' +
      '.zu-empty{color:var(--dim);text-align:center;padding:34px 12px;font-size:13px;}' +
      '.zu-loading{color:var(--mut);padding:20px;text-align:center;font-size:13px;}' +
      '.zu-field{margin-bottom:12px;}' +
      '.zu-field label{display:block;font-size:12px;font-weight:600;color:var(--mut);margin-bottom:4px;}' +
      '.zu-field .zu-hint{font-weight:400;color:var(--dim);}' +
      '.zu-row{display:flex;gap:10px;flex-wrap:wrap;}' +
      '.zu-row>.zu-field{flex:1 1 180px;margin-bottom:12px;}' +
      '.zu-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;}' +
      '.zu-panel h3{margin:0 0 12px;font-size:15px;font-weight:700;}' +
      '.zu-consent{display:flex;gap:9px;align-items:flex-start;background:var(--bg);border:1px solid var(--line2);' +
        'border-left:3px solid var(--green);border-radius:9px;padding:9px 12px;margin-bottom:12px;font-size:12.5px;color:var(--tx);}' +
      '.zu-consent svg{flex:0 0 auto;width:16px;height:16px;color:var(--green);margin-top:2px;}' +
      '.zu-consent b{color:var(--green);}' +
      '.zu-modal{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;' +
        'padding:16px;z-index:9999;}' +
      '.zu-modal-card{background:var(--bg2);border:1px solid var(--line2);border-radius:14px;padding:18px;width:100%;' +
        'max-width:560px;max-height:88vh;overflow:auto;}' +
      '.zu-modal-card h3{margin:0 0 12px;font-size:16px;font-weight:700;}' +
      '.zu-imp-summary{font-size:12px;color:var(--mut);margin:8px 0;}' +
      '.zu-imp-summary b{color:var(--tx);}' +
      '.zu-imp-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px;}' +
      '.zu-imp-table th,.zu-imp-table td{padding:5px 8px;border-bottom:1px solid var(--line);text-align:left;}' +
      '.zu-imp-table th{color:var(--mut);font-size:10.5px;text-transform:uppercase;}' +
      '.zu-bad{color:#ff8080;}' +
      '.zu-modal-acts{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap;}' +
      '@media(max-width:640px){.zu-sel{max-width:none;flex:1 1 140px;}}';
    var s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    (doc.head || doc.documentElement).appendChild(s);
  }

  /* ---------- CSV utilities ---------- */
  // RFC-4180-ish parser: handles quotes, escaped quotes, embedded commas/newlines.
  function parseCSV(text) {
    var rows = [], row = [], field = '', i = 0, inQ = false, ch;
    text = String(text).replace(/^﻿/, ''); // strip BOM
    while (i < text.length) {
      ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQ = false; i++; continue;
        }
        field += ch; i++; continue;
      }
      if (ch === '"') { inQ = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += ch; i++;
    }
    // flush trailing field/row
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }

  function csvEscape(v) {
    v = (v == null) ? '' : String(v);
    if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
    return v;
  }

  // Turn parsed CSV rows into contact objects using a header row.
  function rowsToContacts(rows) {
    if (!rows.length) return { contacts: [], errors: [] };
    var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var idx = {};
    header.forEach(function (h, k) { idx[h] = k; });
    // accept common aliases
    var col = function (names) {
      for (var n = 0; n < names.length; n++) if (idx[names[n]] != null) return idx[names[n]];
      return -1;
    };
    var ci = {
      name: col(['name', 'full name', 'fullname', 'contact']),
      email: col(['email', 'e-mail', 'email address']),
      phone: col(['phone', 'mobile', 'tel', 'telephone']),
      tags: col(['tags', 'tag', 'labels']),
      nameday: col(['nameday', 'name day', 'name_day']),
      notes: col(['notes', 'note'])
    };
    var out = [], errors = [];
    for (var r = 1; r < rows.length; r++) {
      var cells = rows[r];
      var get = function (k) { return ci[k] >= 0 && cells[ci[k]] != null ? String(cells[ci[k]]).trim() : ''; };
      var c = {
        name: get('name'),
        email: get('email'),
        phone: get('phone'),
        nameday: get('nameday'),
        notes: get('notes'),
        tags: get('tags') ? get('tags').split('|').map(function (t) { return t.trim(); }).filter(Boolean) : []
      };
      if (!c.name && !c.email) { errors.push({ row: r + 1, why: 'no name or email' }); continue; }
      if (c.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) {
        errors.push({ row: r + 1, why: 'invalid email: ' + c.email }); continue;
      }
      out.push(c);
    }
    return { contacts: out, errors: errors };
  }

  function parseTagsInput(str) {
    return String(str || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }
  function normTags(t) {
    if (Array.isArray(t)) return t.filter(Boolean);
    if (typeof t === 'string') return t.split(/[|,]/).map(function (x) { return x.trim(); }).filter(Boolean);
    return [];
  }

  /* ============================================================= */
  async function mountAudience(root, ctx) {
    ctx = ctx || {};
    var C = ctx.C || {};
    var esc = C.esc || function (v) { return String(v == null ? '' : v); };
    var toast = ctx.toast || C.toast || noop;
    var relTime = C.relTime || function () { return ''; };
    var ws = ctx.ws;
    var rpc = (C.api && C.api.rpc) ? C.api.rpc.bind(C.api) : null;

    function currentActor(){var session=C.auth&&C.auth.load&&C.auth.load();return session&&session.user_id;}
    var actor=currentActor();
    var disposed=false, loadEpoch=0, canWrite=false, canConsent=false, closeImport=null;
    function active(){return !disposed && !!actor && ctx.ws===ws && currentActor()===actor && root.contains(wrap);}
    function dispose(){if(disposed)return;disposed=true;loadEpoch++;clearTimeout(searchTimer);if(closeImport)closeImport();state.contacts=[];state.knownTags=[];state.q='';state.tag='';if(importState)importState.parsed=null;wrap.replaceChildren();global.removeEventListener('zoi:auth-change',authChanged);}
    function authChanged(){if(!active())dispose();}
    global.addEventListener('zoi:auth-change',authChanged);
    function denied(e){return [401,403].includes(Number(e&&e.status||e&&e.statusCode))||/42501|not_authorized|not_signed_in|no_access_to_workspace|insufficient_permission|suite_session_unavailable/.test(String(e&&e.code||'')+' '+String(e&&e.message||e));}
    function fail(e){if(!active())return;if(denied(e)){canWrite=false;canConsent=false;state.contacts=[];state.knownTags=[];state.error='Your permissions changed. Refresh contacts to check your access.';if(closeImport)closeImport();q('form').replaceChildren();q('form').style.display='none';renderTable();permissions();}toast(e&&e.message||'Request could not be confirmed.','error');}
    injectStyles(document);

    var state = {
      contacts: [],
      loading: true,
      q: '',
      tag: '',
      error: '', knownTags: []   // distinct tags for the filter dropdown
    };
    var searchTimer = null;

    var wrap = el('div', 'zu-wrap');
    root.innerHTML = '';
    root.appendChild(wrap);

    function q(id) { return wrap.querySelector('[data-z="' + id + '"]'); }

    function permissions(){if(!active())return;q('add').hidden=!canWrite;q('add').style.display=canWrite?'':'none';q('import').hidden=!canWrite;q('import').style.display=canWrite?'':'none';q('export').disabled=state.loading||!state.contacts.length;q('permission').textContent=state.error||(!canWrite?'You have read-only access to these contacts.':'');}
    /* ---------- shell ---------- */
    function renderShell() {
      wrap.innerHTML =
        '<div class="zu-head">' +
          '<h2 class="zu-title">Audience</h2>' +
          '<span class="zu-count" data-z="count"></span>' +
          '<span class="zu-spacer"></span>' +
          '<button class="zu-btn ghost" data-z="import">Import CSV</button>' +
          '<button class="zu-btn ghost" data-z="export">Export CSV</button>' +
          '<button class="zu-btn pri" data-z="add">+ Add contact</button>' +
        '</div>' +
        '<p class="zu-sub" data-z="permission" role="status"></p>' + '<div class="zu-toolbar">' +
          '<div class="zu-search"><input class="zu-input" data-z="q" type="search" placeholder="Search name, email, phone…"></div>' +
          '<select class="zu-sel" data-z="tag"><option value="">All tags</option></select>' +
        '</div>' +
        '<div class="zu-panel" data-z="form" style="display:none"></div>' +
        '<div class="zu-tablewrap"><div class="zu-loading" data-z="table">Loading…</div></div>';

      q('add').addEventListener('click', function () { openForm(null); });
      q('import').addEventListener('click', function () { openImport(); });
      q('export').addEventListener('click', function () { doExport(); });

      q('q').addEventListener('input', function () {
        state.q = this.value;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () { reload().then(renderTable); }, 220);
      });
      q('tag').addEventListener('change', function () {
        state.tag = this.value;
        reload().then(renderTable);
      });
    }

    function refreshTagFilter() {
      var sel = q('tag');
      if (!sel) return;
      var cur = state.tag;
      var opts = '<option value="">All tags</option>';
      state.knownTags.forEach(function (t) {
        opts += '<option value="' + esc(t) + '"' + (t === cur ? ' selected' : '') + '>' + esc(t) + '</option>';
      });
      sel.innerHTML = opts;
    }

    function collectKnownTags() {
      var set = {};
      state.contacts.forEach(function (c) {
        normTags(c.tags).forEach(function (t) { if (t) set[t] = true; });
      });
      // keep the active filter tag present even if current page has none
      if (state.tag) set[state.tag] = true;
      state.knownTags = Object.keys(set).sort(function (a, b) {
        return a.toLowerCase().localeCompare(b.toLowerCase());
      });
    }

    /* ---------- table ---------- */
    function renderTable() {
      if(!active())return;permissions();
      var host = q('table');
      if (!host) return;
      var cs = state.contacts;
      var label = cs.length + (cs.length === 1 ? ' contact' : ' contacts');
      if (state.q || state.tag) label += ' matching filter';
      q('count').textContent = label;
      collectKnownTags();
      refreshTagFilter();

      if (state.loading) { host.className = 'zu-loading'; host.textContent = 'Loading…'; return; }
      if (!cs.length) {
        host.className = 'zu-empty';
        if(state.error){host.textContent=state.error;return;}
        host.innerHTML = (state.q || state.tag)
          ? 'No contacts match your search.'
          : 'No contacts yet.<br>Add one, or import a CSV of people who opted in.';
        return;
      }

      var tbl = el('table', 'zu-table');
      tbl.innerHTML =
        '<thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Tags</th><th>Nameday</th><th></th></tr></thead>';
      var tb = el('tbody');
      cs.forEach(function (c) {
        var tr = el('tr');
        var chips = normTags(c.tags).map(function (t) { return '<span class="zu-chip">' + esc(t) + '</span>'; }).join('');
        tr.innerHTML =
          '<td><div class="zu-name">' + (esc(c.name) || '<span class="zu-sub">(no name)</span>') + '</div>' +
            (c.notes ? '<div class="zu-sub">' + esc(String(c.notes).slice(0, 60)) + (String(c.notes).length > 60 ? '…' : '') + '</div>' : '') + '</td>' +
          '<td>' + (esc(c.email) || '<span class="zu-sub">—</span>') + '</td>' +
          '<td>' + (esc(c.phone) || '<span class="zu-sub">—</span>') + '</td>' +
          '<td><div class="zu-chips">' + (chips || '<span class="zu-sub">—</span>') + '</div></td>' +
          '<td>' + (esc(c.nameday) || '<span class="zu-sub">—</span>') + '</td>' +
          '<td><div class="zu-rowacts">' +
            '<button class="zu-btn ghost sm" data-act="edit">Edit</button>' +
            '<button class="zu-btn danger ghost sm" data-act="del">Delete</button>' +
          '</div></td>';
        tr.querySelector('.zu-rowacts').hidden=!canWrite;tr.querySelector('.zu-rowacts').style.display=canWrite?'':'none';
        tr.querySelector('[data-act="edit"]').addEventListener('click', function () { openForm(c); });
        tr.querySelector('[data-act="del"]').addEventListener('click', function () { doDelete(c); });
        tb.appendChild(tr);
      });
      tbl.appendChild(tb);
      host.className = '';
      host.innerHTML = '';
      host.appendChild(tbl);
    }

    /* ---------- add / edit form ---------- */
    function openForm(c) {
      if(!active()||!canWrite)return;
      c = c || {};
      var editing = c.id != null;
      var host = q('form');
      host.style.display = '';
      host.innerHTML =
        '<h3>' + (editing ? 'Edit contact' : 'Add contact') + '</h3>' +
        '<div class="zu-row">' +
          '<div class="zu-field"><label>Name</label>' +
            '<input class="zu-input" data-z="f_name" maxlength="120" value="' + esc(c.name) + '" placeholder="First Last"></div>' +
          '<div class="zu-field"><label>Email</label>' +
            '<input class="zu-input" data-z="f_email" type="email" maxlength="160" value="' + esc(c.email) + '" placeholder="name@example.com"></div>' +
        '</div>' +
        '<div class="zu-row">' +
          '<div class="zu-field"><label>Phone</label>' +
            '<input class="zu-input" data-z="f_phone" maxlength="40" value="' + esc(c.phone) + '" placeholder="+1 …"></div>' +
          '<div class="zu-field"><label>Nameday <span class="zu-hint">(e.g. Jan 7 / Ιωάννης)</span></label>' +
            '<input class="zu-input" data-z="f_nameday" maxlength="60" value="' + esc(c.nameday) + '" placeholder="Nameday"></div>' +
        '</div>' +
        '<div class="zu-field"><label>Tags <span class="zu-hint">(comma-separated)</span></label>' +
          '<input class="zu-input" data-z="f_tags" value="' + esc(normTags(c.tags).join(', ')) + '" placeholder="customers, vip, newsletter"></div>' +
        '<div class="zu-field"><label>Notes</label>' +
          '<textarea class="zu-ta" data-z="f_notes" style="font-family:inherit;font-size:13px" placeholder="Anything worth remembering…">' + esc(c.notes) + '</textarea></div>' +
        '<div class="zu-actions">' +
          '<button class="zu-btn pri" data-z="f_save">' + (editing ? 'Save changes' : 'Add contact') + '</button>' +
          '<button class="zu-btn ghost" data-z="f_cancel">Cancel</button>' +
        '</div>';

      q('f_cancel').addEventListener('click', function () { host.style.display = 'none'; host.innerHTML = ''; });
      var consentBox = el('div', 'zu-field');
      consentBox.innerHTML = '<label><input type="checkbox" data-z="f_consent"> Record explicit permission for marketing emails</label><input class="zu-input" data-z="f_consent_source" placeholder="Evidence: signup form, date, or written permission" maxlength="1000"><label>When permission was given <input class="zu-input" type="datetime-local" data-z="f_consent_date"></label><small>Leave unchecked unless you have permission. Previously unsubscribed recipients stay suppressed.</small>';
      if(canConsent)host.insertBefore(consentBox, q('f_save').parentNode);
      q('f_save').addEventListener('click', function () { doSave(c.id != null ? c.id : null); });
      if (q('f_name')) q('f_name').focus();
    }

    async function doSave(id) {
      if(!active()||!canWrite)return;
      var name = (q('f_name') && q('f_name').value || '').trim();
      var email = (q('f_email') && q('f_email').value || '').trim();
      var phone = (q('f_phone') && q('f_phone').value || '').trim();
      var nameday = (q('f_nameday') && q('f_nameday').value || '').trim();
      var recordConsent = q('f_consent') && q('f_consent').checked;
      var consentSource = (q('f_consent_source') && q('f_consent_source').value || '').trim();
      var consentAt = new Date(q('f_consent_date') && q('f_consent_date').value || '');
      if (recordConsent && (isNaN(consentAt.getTime()) || consentAt.getTime() > Date.now())) { toast('Enter when the recipient gave permission, using a past date and time.', 'warn'); return; }
      if (recordConsent && (consentSource.length < 8 || !(q('f_email') && q('f_email').value.trim()))) { toast('Add an email and describe where and when this person agreed to marketing emails.', 'warn'); return; }
      var notes = (q('f_notes') && q('f_notes').value || '').trim();
      var tags = parseTagsInput(q('f_tags') && q('f_tags').value);

      if (!name && !email) { toast('Add at least a name or an email.', 'warn'); return; }
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('That email looks off.', 'warn'); return; }
      if (!rpc) { toast('Not connected.', 'error'); return; }

      var btn = q('f_save');
      btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Saving…';
      try {
        var contactReceipt = await rpc('audience_upsert', {
          p_workspace: ws, p_name: name, p_email: email, p_phone: phone,
          p_nameday: nameday, p_tags: tags, p_notes: notes, p_id: id || null
        }, { auth: 'require' });
        if(!active())return;
        if (typeof contactReceipt !== 'string' || !/^[0-9a-f-]{36}$/i.test(contactReceipt)) throw new Error('The contact save was not confirmed. Your form is unchanged.');
        if (recordConsent) {
          var consent = await rpc('email_consent_record', { p_workspace: ws, p_email: email, p_name: name, p_tags: tags, p_source: consentSource, p_consented_at: consentAt.toISOString() }, { auth: 'require' });
          if(!active())return;
          if (!consent || consent.ok !== true) throw new Error('Contact saved, but marketing consent was not confirmed. No marketing eligibility was added.');
        }
        q('form').style.display = 'none'; q('form').innerHTML = '';
        await reload(); renderTable();
        if(!active()||state.error)return;
        toast(id ? 'Contact updated.' : 'Contact added.', 'success');
      } catch (e) {
        if(!active())return;fail(e);
        btn.disabled = false; btn.textContent = prev;
      }
    }

    async function doDelete(c) {
      if(!active()||!canWrite)return;
      if (!global.confirm('Delete ' + (c.name || c.email || 'this contact') + '? This cannot be undone.')) return;
      if (!rpc) { toast('Not connected.', 'error'); return; }
      try {
        var deleted=await rpc('audience_delete', { p_workspace: ws, p_id: c.id }, { auth: 'require' });
        if(!active())return;if(deleted!==true)throw Error('Contact deletion was not confirmed. Refresh the list.');
        await reload(); renderTable();
        if(!active()||state.error)return;
        toast('Contact deleted.', 'success');
      } catch (e) {
        fail(e);
      }
    }

    /* ---------- CSV import ---------- */
    var importState = { parsed: null };

    function openImport() {
      if(!active()||!canWrite)return;if(closeImport)closeImport();
      var overlay = el('div', 'zu-modal');
      overlay.innerHTML =
        '<div class="zu-modal-card">' +
          '<h3>Import contacts from CSV</h3>' +
          '<div class="zu-consent">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' +
            '<div><b>Only import contacts who agreed to hear from you.</b> Imported contacts are not automatically eligible for marketing emails. ' +
              'Record each recipient’s permission in their contact form before sending.</div>' +
          '</div>' +
          '<div class="zu-field"><label>Columns: <span class="zu-hint">name, email, phone, tags (pipe | separated), nameday, notes</span></label>' +
            '<textarea class="zu-ta" data-z="csv" placeholder="name,email,phone,tags,nameday,notes&#10;Maria K,maria@example.com,+1..,customers|vip,Aug 15,Met at market"></textarea></div>' +
          '<div class="zu-actions" style="margin-bottom:8px">' +
            '<label class="zu-btn ghost sm" style="cursor:pointer">Choose file…' +
              '<input type="file" data-z="file" accept=".csv,text/csv,text/plain" style="display:none"></label>' +
            '<button class="zu-btn ghost sm" data-z="parse">Preview</button>' +
          '</div>' +
          '<div data-z="preview"></div>' +
          '<div class="zu-modal-acts">' +
            '<button class="zu-btn ghost" data-z="cancel">Cancel</button>' +
            '<button class="zu-btn pri" data-z="do" disabled>Import</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(overlay);

      function mq(id) { return overlay.querySelector('[data-z="' + id + '"]'); }
      closeImport=close;
      function close() { closeImport=null;if (overlay.parentNode) overlay.parentNode.removeChild(overlay); importState.parsed = null; }

      overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
      mq('cancel').addEventListener('click', close);

      mq('file').addEventListener('change', function () {
        var f = this.files && this.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () { if(!active()||!overlay.isConnected)return;mq('csv').value = String(reader.result || ''); doPreview(); };
        reader.onerror = function () { toast('Could not read that file.', 'error'); };
        reader.readAsText(f);
      });

      mq('parse').addEventListener('click', doPreview);

      function doPreview() {
        if(!active()||!canWrite)return;
        var text = mq('csv').value || '';
        if (!text.trim()) { toast('Paste CSV or choose a file first.', 'warn'); return; }
        var rows = parseCSV(text);
        var res = rowsToContacts(rows);
        importState.parsed = res.contacts;
        var prev = mq('preview');
        if (!res.contacts.length) {
          prev.innerHTML = '<div class="zu-imp-summary zu-bad">No valid rows found. ' +
            'Make sure the first line is a header with a <b>name</b> or <b>email</b> column.</div>' +
            (res.errors.length ? errorList(res.errors) : '');
          mq('do').disabled = true;
          return;
        }
        var show = res.contacts.slice(0, 8);
        var body = show.map(function (c) {
          return '<tr><td>' + esc(c.name || '—') + '</td><td>' + esc(c.email || '—') + '</td>' +
            '<td>' + esc(c.phone || '—') + '</td><td>' + esc(c.tags.join(', ') || '—') + '</td></tr>';
        }).join('');
        prev.innerHTML =
          '<div class="zu-imp-summary"><b>' + res.contacts.length + '</b> ready to import' +
            (res.errors.length ? ', <span class="zu-bad">' + res.errors.length + ' skipped</span>' : '') +
            (res.contacts.length > show.length ? ' (showing first ' + show.length + ')' : '') + '.</div>' +
          '<table class="zu-imp-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Tags</th></tr></thead>' +
            '<tbody>' + body + '</tbody></table>' +
          (res.errors.length ? errorList(res.errors) : '');
        mq('do').disabled = false;
      }

      function errorList(errs) {
        var items = errs.slice(0, 6).map(function (e) {
          return '<div class="zu-imp-summary zu-bad">Row ' + e.row + ': ' + esc(e.why) + '</div>';
        }).join('');
        if (errs.length > 6) items += '<div class="zu-imp-summary zu-bad">…and ' + (errs.length - 6) + ' more.</div>';
        return items;
      }

      mq('do').addEventListener('click', function () {
        if(!active()||!canWrite)return;
        var contacts = importState.parsed;
        if (!contacts || !contacts.length) { toast('Nothing to import.', 'warn'); return; }
        if (!rpc) { toast('Not connected.', 'error'); return; }
        var btn = mq('do'); btn.disabled = true; var prev = btn.textContent; btn.textContent = 'Importing…';
        rpc('audience_import', { p_workspace: ws, p_rows: contacts }, { auth: 'require' })
          .then(function (summary) {
            if(!active())return;
            if(!summary||!Number.isInteger(summary.added)||!Number.isInteger(summary.skipped)||summary.added<0||summary.skipped<0||summary.added+summary.skipped!==contacts.length)throw Error('Import result could not be verified. Refresh contacts before retrying.');
            var n=summary.added;
            close();
            return reload().then(function () {
              if(!active()||state.error)return;renderTable();
              toast('Imported ' + n + (n === 1 ? ' contact.' : ' contacts.'), 'success');
            });
          })
          .catch(function (e) {
            if(!active())return;fail(e);
            btn.disabled = false; btn.textContent = prev;
          });
      });
    }

    /* ---------- CSV export (client-side Blob) ---------- */
    function doExport() {
      if(!active())return;
      var cs = state.contacts;
      if (!cs.length) { toast('Nothing to export.', 'warn'); return; }
      var header = ['name', 'email', 'phone', 'tags', 'nameday', 'notes'];
      var lines = [header.join(',')];
      cs.forEach(function (c) {
        lines.push([
          csvEscape(c.name),
          csvEscape(c.email),
          csvEscape(c.phone),
          csvEscape(normTags(c.tags).join('|')),
          csvEscape(c.nameday),
          csvEscape(c.notes)
        ].join(','));
      });
      var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = 'zoi-audience-' + stamp + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast('Exported ' + cs.length + ' contact' + (cs.length === 1 ? '' : 's') + '.', 'success');
    }

    /* ---------- data ---------- */
    async function reload() {
      if(!active())return;
      var epoch=++loadEpoch;state.loading=true;state.error='';canWrite=false;canConsent=false;permissions();
      try {
        if(!rpc)throw Error('Not connected.');
        var access=await rpc('audience_access',{p_workspace:ws},{auth:'require'});
        if(!active()||epoch!==loadEpoch)return;
        if(!access||access.ok!==true||access.workspace_id!==ws||typeof access.can_write!=='boolean'||typeof access.can_record_consent!=='boolean')throw Error('Contact permissions could not be verified.');
        canWrite=access.can_write;canConsent=access.can_record_consent;
        if(!canWrite){q('form').replaceChildren();q('form').style.display='none';if(closeImport)closeImport();}
        var rows=await rpc('audience_list',{p_workspace:ws,p_q:state.q||null,p_tag:state.tag||null},{auth:'require'});
        if(!active()||epoch!==loadEpoch)return;
        if(!Array.isArray(rows))throw Error('Contacts could not be verified.');
        state.contacts=rows;
      } catch(e) {
        if(!active()||epoch!==loadEpoch)return;
        state.contacts=[];state.knownTags=[];state.error=e&&e.message||'Could not load contacts.';canWrite=false;canConsent=false;
        q('form').replaceChildren();q('form').style.display='none';if(closeImport)closeImport();toast(state.error,'error');
      }
      if(!active()||epoch!==loadEpoch)return;state.loading=false;
    }

    /* ---------- boot ---------- */
    renderShell();permissions();
    await reload();
    renderTable();
    return {destroy:dispose,unmount:dispose};
  }

  /* ---------- register ---------- */
  global.ZoiSuite = global.ZoiSuite || { modules: [] };
  global.ZoiSuite.modules.push({
    id: 'audience',
    label: 'Audience',
    order: 60,
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
      '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    mount: mountAudience
  });
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
