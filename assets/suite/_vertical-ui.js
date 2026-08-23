/*!
 * _vertical-ui.js — renders the per-vertical profile form.
 *
 * Pairs with _vertical-forms.js (the schemas) and writes through
 * bizpage_save_profile. Classic script, zero dependencies.
 *
 * THE RULE THAT SHAPES THIS FILE
 * A value the enrichment worker read off someone's website is shown in the form
 * but is NOT saved as the owner's word until they accept it. Pre-filling and
 * silently promoting on save would turn a machine guess into "the owner said so"
 * for anyone who clicks Save without reading — which is precisely the honesty
 * the database schema was split to protect. So a suggested value sits in the
 * field greyed, with Use / Ignore, and only a field the owner has touched or
 * accepted is written.
 *
 * Exposes ZoiVerticalUI.render(container, opts) -> { read, hasChanges, count }
 */
(function (global) {
  'use strict';

  var F = null;   // resolved at render time so load order does not matter

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }
  function el(tag, cls, html) {
    var n = global.document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var CSS = [
    '.vf{display:grid;gap:18px;margin:18px 0 0}',
    '.vf-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}',
    '.vf-head h4{margin:0;font-size:15px;font-weight:700;letter-spacing:-.01em}',
    '.vf-head .vf-kind{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);font-weight:700}',
    '.vf-note{margin:0;font-size:12.5px;color:var(--mut);line-height:1.55}',
    '.vf-found{border:1px solid color-mix(in oklab,var(--acc) 34%,var(--line));border-radius:12px;',
    'background:color-mix(in oklab,var(--acc) 7%,transparent);padding:12px 14px;display:grid;gap:8px}',
    '.vf-found p{margin:0;font-size:13px;line-height:1.55;color:var(--tx)}',
    '.vf-found p span{color:var(--mut)}',
    '.vf-found .vf-acts{display:flex;gap:8px;flex-wrap:wrap}',
    '.vf-f{display:grid;gap:6px}',
    '.vf-f>label{font-size:12.5px;font-weight:650;color:var(--tx);display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.vf-hint{font-size:11.5px;color:var(--dim);line-height:1.5}',
    '.vf-in,.vf-f textarea,.vf-f select{width:100%;box-sizing:border-box;background:var(--bg2);color:var(--tx);',
    'border:1px solid var(--line);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px}',
    '.vf-f textarea{min-height:86px;resize:vertical;line-height:1.55}',
    '.vf-in:focus,.vf-f textarea:focus,.vf-f select:focus{outline:none;border-color:color-mix(in oklab,var(--acc) 60%,var(--line))}',
    '.vf-in[data-suggested="1"]{color:var(--mut);border-style:dashed}',
    '.vf-tag{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;',
    'border:1px solid var(--line);background:var(--card2);font-size:12.5px;font-weight:600;color:var(--tx)}',
    '.vf-tag button{border:0;background:none;color:var(--dim);cursor:pointer;font-size:14px;line-height:1;padding:0}',
    '.vf-tag button:hover{color:var(--red)}',
    '.vf-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}',
    '.vf-rep{display:grid;gap:8px}',
    '.vf-row{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));align-items:end;',
    'padding:10px;border:1px solid var(--line);border-radius:11px;background:var(--card2)}',
    '.vf-row .vf-f>label{font-size:11px;color:var(--mut);font-weight:600}',
    '.vf-row .vf-del{grid-column:1/-1;justify-self:end}',
    '.vf-mini{border:1px solid var(--line);background:var(--bg2);color:var(--mut);border-radius:8px;',
    'padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer}',
    '.vf-mini:hover{color:var(--tx);border-color:var(--line2)}',
    '.vf-hours{display:grid;gap:6px}',
    '.vf-hrow{display:grid;grid-template-columns:52px 1fr 1fr;gap:8px;align-items:center}',
    '.vf-hrow b{font-size:12px;color:var(--mut);font-weight:600}',
    '.vf-badge{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700;',
    'color:var(--acc);border:1px solid color-mix(in oklab,var(--acc) 40%,transparent);',
    'border-radius:999px;padding:2px 7px}',
    '@media (max-width:560px){.vf-hrow{grid-template-columns:46px 1fr 1fr}}'
  ].join('');

  function injectStyle() {
    var d = global.document;
    if (d.getElementById('zoi-vf-css')) return;
    var s = d.createElement('style');
    s.id = 'zoi-vf-css';
    s.textContent = CSS;
    d.head.appendChild(s);
  }

  /* ---------- individual controls ---------- */

  function input(type, value, ph) {
    var i = el('input', 'vf-in');
    i.type = type === 'url' ? 'url' : type === 'tel' ? 'tel'
      : type === 'mail' ? 'email' : type === 'time' ? 'time' : 'text';
    i.value = value == null ? '' : String(value);
    if (ph) i.placeholder = ph;
    return i;
  }

  function tagsControl(values) {
    var wrap = el('div');
    var list = el('div', 'vf-tags');
    var box = input('text', '', 'Type and press Enter');
    var vals = Array.isArray(values) ? values.slice() : [];
    function paint() {
      list.innerHTML = '';
      vals.forEach(function (v, idx) {
        var t = el('span', 'vf-tag', esc(v) + ' ');
        var b = el('button', null, '&times;');
        b.type = 'button';
        b.setAttribute('aria-label', 'Remove ' + v);
        b.addEventListener('click', function () { vals.splice(idx, 1); paint(); });
        t.appendChild(b);
        list.appendChild(t);
      });
    }
    function add() {
      var v = box.value.trim();
      if (!v) return;
      // comma-separated paste is the common case; split it rather than storing
      // "Greek, English" as one tag
      v.split(',').map(function (x) { return x.trim(); })
        .filter(Boolean)
        .forEach(function (x) { if (vals.indexOf(x) === -1) vals.push(x); });
      box.value = '';
      paint();
    }
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    });
    box.addEventListener('blur', add);
    paint();
    wrap.appendChild(list);
    wrap.appendChild(box);
    wrap.__read = function () { add(); return vals.slice(); };
    return wrap;
  }

  function hoursControl(value) {
    var wrap = el('div', 'vf-hours');
    var byDay = {};
    (Array.isArray(value) ? value : []).forEach(function (r) {
      if (r && r.day) byDay[String(r.day).toLowerCase().slice(0, 3)] = r;
    });
    var rows = [];
    F.DAYS.forEach(function (d) {
      var r = el('div', 'vf-hrow');
      var lab = el('b', null, d[1]);
      var cur = byDay[d[0]] || {};
      var o = input('time', cur.open || '');
      var c = input('time', cur.close || '');
      o.setAttribute('aria-label', d[1] + ' opens');
      c.setAttribute('aria-label', d[1] + ' closes');
      r.appendChild(lab); r.appendChild(o); r.appendChild(c);
      wrap.appendChild(r);
      rows.push({ day: d[0], o: o, c: c });
    });
    wrap.__read = function () {
      var out = [];
      rows.forEach(function (r) {
        var a = r.o.value.trim(), b = r.c.value.trim();
        // A day with only one side filled is a mistake, not a half-open day —
        // dropping it beats publishing "opens 09:00, closes ".
        if (a && b) out.push({ day: r.day, open: a, close: b });
      });
      return out;
    };
    return wrap;
  }

  function repeatControl(field, value) {
    var wrap = el('div', 'vf-rep');
    var rows = [];
    function addRow(vals) {
      var row = el('div', 'vf-row');
      var subs = [];
      field.of.forEach(function (sf) {
        var f = el('div', 'vf-f');
        var lab = el('label', null, esc(sf.label));
        var ctl = sf.type === F.T.SELECT ? selectControl(sf, vals && vals[sf.k])
          : input(sf.type, vals ? vals[sf.k] : '', sf.ph);
        f.appendChild(lab); f.appendChild(ctl);
        row.appendChild(f);
        subs.push({ k: sf.k, ctl: ctl });
      });
      var del = el('button', 'vf-mini vf-del', 'Remove');
      del.type = 'button';
      del.addEventListener('click', function () {
        row.remove();
        rows = rows.filter(function (r) { return r.row !== row; });
      });
      row.appendChild(del);
      wrap.insertBefore(row, addBtn);
      rows.push({ row: row, subs: subs });
    }
    var addBtn = el('button', 'vf-mini', '+ Add');
    addBtn.type = 'button';
    addBtn.addEventListener('click', function () { addRow(null); });
    wrap.appendChild(addBtn);
    (Array.isArray(value) ? value : []).forEach(function (v) { addRow(v); });
    wrap.__read = function () {
      return rows.map(function (r) {
        var o = {};
        r.subs.forEach(function (s) { var v = s.ctl.value; if (v && v.trim()) o[s.k] = v.trim(); });
        return o;
      }).filter(function (o) { return Object.keys(o).length; });
    };
    return wrap;
  }

  function selectControl(field, value) {
    var s = global.document.createElement('select');
    s.className = 'vf-in';
    (field.opts || []).forEach(function (o) {
      var op = global.document.createElement('option');
      op.value = o[0]; op.textContent = o[1];
      if (String(value || '') === String(o[0])) op.selected = true;
      s.appendChild(op);
    });
    return s;
  }

  /* ---------- the form ---------- */

  /**
   * render(container, {entityType, categorySlug, profile, onDirty})
   * -> { read(), suggestedCount, acceptAll(), ignoreAll() }
   */
  function render(container, opts) {
    F = global.ZoiVerticalForms;
    if (!F) return null;
    injectStyle();
    opts = opts || {};
    var spec = F.fieldsFor(opts.entityType, opts.categorySlug);
    var part = F.partition(opts.profile, spec.fields);

    container.innerHTML = '';
    var wrap = el('div', 'vf');

    var head = el('div', 'vf-head');
    head.appendChild(el('h4', null, esc(spec.title)));
    head.appendChild(el('span', 'vf-kind', esc(spec.key)));
    wrap.appendChild(head);
    if (spec.note) wrap.appendChild(el('p', 'vf-note', esc(spec.note)));

    var controls = [];
    var suggested = [];

    /* The "we found this" banner. Only shown when there is something to offer,
       and it never claims the values are confirmed. */
    var banner = null;
    if (part.fromWebsite.length) {
      var host = '';
      try { host = new global.URL(part.source).hostname.replace(/^www\./, ''); } catch (e) { host = ''; }
      banner = el('div', 'vf-found');
      banner.appendChild(el('p', null,
        '<b>' + part.fromWebsite.length + ' thing' + (part.fromWebsite.length === 1 ? '' : 's')
        + ' we read from ' + (host ? esc(host) : 'your website') + '</b> '
        + '<span>' + (part.checked ? 'on ' + esc(part.checked) + '. ' : '')
        + 'Nothing below is saved as yours until you accept it.</span>'));
      var acts = el('div', 'vf-acts');
      var useAll = el('button', 'vf-mini', 'Use all of it');
      var dropAll = el('button', 'vf-mini', 'Ignore all');
      useAll.type = dropAll.type = 'button';
      acts.appendChild(useAll); acts.appendChild(dropAll);
      banner.appendChild(acts);
      wrap.appendChild(banner);
      useAll.addEventListener('click', function () { suggested.forEach(function (s) { s.accept(); }); });
      dropAll.addEventListener('click', function () { suggested.forEach(function (s) { s.ignore(); }); });
    }

    spec.fields.forEach(function (f) {
      var isSuggested = part.fromWebsite.indexOf(f.k) !== -1;
      var value = isSuggested ? part.found[f.k] : part.own[f.k];

      var box = el('div', 'vf-f');
      var lab = el('label', null, esc(f.label));
      if (isSuggested) lab.appendChild(el('span', 'vf-badge', 'from your site'));
      box.appendChild(lab);

      var ctl;
      if (f.type === F.T.AREA) {
        ctl = global.document.createElement('textarea');
        ctl.className = 'vf-in';
        ctl.value = value == null ? '' : String(value);
        if (f.max) ctl.maxLength = f.max;
      } else if (f.type === F.T.TAGS) { ctl = tagsControl(value); }
      else if (f.type === F.T.HOURS) { ctl = hoursControl(value); }
      else if (f.type === F.T.REPEAT) { ctl = repeatControl(f, value); }
      else if (f.type === F.T.SELECT) { ctl = selectControl(f, value); }
      else { ctl = input(f.type, value, f.ph); if (f.max) ctl.maxLength = f.max; }
      box.appendChild(ctl);

      /* A suggested value is present but not owned. It only counts once the
         owner accepts it or edits it — clicking Save without reading must not
         silently turn a machine guess into their statement. */
      var accepted = !isSuggested;
      if (isSuggested) {
        if (ctl.setAttribute) ctl.setAttribute('data-suggested', '1');
        var row = el('div', 'vf-acts');
        var yes = el('button', 'vf-mini', 'Use this');
        var no = el('button', 'vf-mini', 'Ignore');
        yes.type = no.type = 'button';
        row.appendChild(yes); row.appendChild(no);
        box.appendChild(row);
        var s = {
          accept: function () {
            accepted = true;
            if (ctl.removeAttribute) ctl.removeAttribute('data-suggested');
            row.remove();
            var b = lab.querySelector('.vf-badge');
            if (b) b.remove();
            if (opts.onDirty) opts.onDirty();
          },
          ignore: function () {
            accepted = false;
            if (ctl.value !== undefined) ctl.value = '';
            if (ctl.removeAttribute) ctl.removeAttribute('data-suggested');
            row.remove();
            var b2 = lab.querySelector('.vf-badge');
            if (b2) b2.remove();
            if (opts.onDirty) opts.onDirty();
          }
        };
        yes.addEventListener('click', s.accept);
        no.addEventListener('click', s.ignore);
        // editing it is acceptance
        ['input', 'change'].forEach(function (ev) {
          ctl.addEventListener(ev, function () { if (!accepted) s.accept(); }, { once: true });
        });
        suggested.push(s);
      }

      if (f.hint) box.appendChild(el('p', 'vf-hint', esc(f.hint)));

      /* Bilingual sibling. Never machine-translated — if it is in Greek it is
         because someone wrote it in Greek. */
      var elCtl = null;
      if (f.bi) {
        var bl = el('label', null, esc(f.label) + ' <span class="vf-hint" style="font-weight:400">in Greek (optional)</span>');
        var bi = (f.type === F.T.AREA) ? (function () {
          var t = global.document.createElement('textarea'); t.className = 'vf-in';
          t.value = (opts.profile && opts.profile[f.k + '_el']) || ''; return t;
        })() : input('text', (opts.profile && opts.profile[f.k + '_el']) || '');
        bi.setAttribute('lang', 'el');
        box.appendChild(bl); box.appendChild(bi);
        elCtl = bi;
      }

      wrap.appendChild(box);
      controls.push({ f: f, ctl: ctl, elCtl: elCtl, isAccepted: function () { return accepted; } });
      if (opts.onDirty) {
        ['input', 'change'].forEach(function (ev) { ctl.addEventListener(ev, opts.onDirty); });
        if (elCtl) ['input', 'change'].forEach(function (ev) { elCtl.addEventListener(ev, opts.onDirty); });
      }
    });

    container.appendChild(wrap);

    return {
      suggestedCount: part.fromWebsite.length,
      /** The profile object to save. Only accepted or owner-typed values. */
      read: function () {
        var out = {};
        controls.forEach(function (c) {
          if (!c.isAccepted()) return;                 // an unread suggestion is not a statement
          var v = c.ctl.__read ? c.ctl.__read() : c.ctl.value;
          if (!F.isEmpty(v)) out[c.f.k] = v;
          if (c.elCtl && c.elCtl.value && c.elCtl.value.trim()) out[c.f.k + '_el'] = c.elCtl.value.trim();
        });
        return F.clean(out);
      }
    };
  }

  global.ZoiVerticalUI = { render: render, CSS: CSS };
})(typeof window !== 'undefined' ? window : globalThis);
