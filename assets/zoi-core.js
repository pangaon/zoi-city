/*!
 * zoi-core.js — shared foundation for zoi.city pages
 * Version 1.0.0 (2026-08-22)
 *
 * Classic script (no ES modules). Exposes ONE global: ZoiCore, with the
 * helpers every page previously inlined: BASE/KEY, esc(), relTime(),
 * toast(), theme {init,flip,current}, auth {load,save,clear,token,
 * ensureFresh,isSignedIn}, api.rpc(fn, params, {auth:'require'|'prefer'|
 * 'anon'}), otp {send,verify} (Supabase GoTrue email-code sign-in).
 * Storage keys: zoi_auth, zoi_ws, zoi_theme, zoi_pending_email.
 * Semantics (matching the existing pages):
 *   - token considered usable when expires_at*1000 > Date.now()+5000
 *   - ensureFresh(): fresh when expires_at*1000 > Date.now()+30000, else
 *     POST /auth/v1/token?grant_type=refresh_token; on success stores
 *     expires_at = floor(now/1000) + (expires_in||3600). Resolves false
 *     (never throws) when refresh is impossible or fails.
 *   - rpc() throws Error with the server's message (message|msg|
 *     error_description|error|hint), falling back to the raw body.
 * Defensive: localStorage denial never throws anywhere.
 *
 * Usage: <script src="/assets/zoi-core.js"></script>
 */
(function (global) {
  'use strict';

  var BASE = 'https://csebihpaychdkanjjsmz.supabase.co';
  var KEY = 'sb_publishable_BM4ZQtOCUhjg7VqyFGJGRw_eFyTgI4j';
  var K_AUTH = 'zoi_auth', K_THEME = 'zoi_theme', K_PENDING = 'zoi_pending_email', K_WS = 'zoi_ws';

  /* ---- safe localStorage (never throws) ---- */
  function lsGet(k){ try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v){ try { global.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k){ try { global.localStorage.removeItem(k); } catch (e) {} }

  /* ---- pure helpers ---- */
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function relTime(iso){
    if (!iso) return '';
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.floor(d / 60) + 'm';
    if (d < 86400) return Math.floor(d / 3600) + 'h';
    if (d < 604800) return Math.floor(d / 86400) + 'd';
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /* ---- toast (creates its own element if the page has none) ---- */
  var _toastTimer = null;
  function toast(msg, mountId){
    var doc = global.document; if (!doc) return;
    var t = doc.getElementById(mountId || 'toast');
    if (!t) {
      t = doc.createElement('div');
      t.id = mountId || 'toast'; t.className = 'toast'; t._zoiOwned = true;
      t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#10314f;color:#fff;padding:10px 18px;border-radius:10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25);opacity:0;transition:opacity .25s;z-index:9999;pointer-events:none;max-width:88vw';
      if (doc.body) doc.body.appendChild(t);
    }
    t.textContent = String(msg == null ? '' : msg);
    t.classList.add('show');
    if (t._zoiOwned) t.style.opacity = '1';
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () {
      t.classList.remove('show');
      if (t._zoiOwned) t.style.opacity = '0';
    }, 2600);
  }

  /* ---- theme (data-theme attr + zoi_theme key) ---- */
  var theme = {
    init: function (def) {
      var t = lsGet(K_THEME) || def || 'dark';
      try { global.document.documentElement.setAttribute('data-theme', t); } catch (e) {}
      return t;
    },
    current: function () {
      var t = null;
      try { t = global.document.documentElement.getAttribute('data-theme'); } catch (e) {}
      return t || lsGet(K_THEME) || 'dark';
    },
    flip: function () {
      var t = theme.current() === 'light' ? 'dark' : 'light';
      try { global.document.documentElement.setAttribute('data-theme', t); } catch (e) {}
      lsSet(K_THEME, t);
      return t;
    }
  };

  /* ---- auth session {access_token, refresh_token, expires_at, email} ---- */
  var _auth = null, _loaded = false;
  function authLoad(){
    _auth = null; _loaded = true;
    var raw = lsGet(K_AUTH);
    if (raw) { try { var a = JSON.parse(raw); if (a && a.access_token) _auth = a; } catch (e) {} }
    return _auth;
  }
  function cur(){ return _loaded ? _auth : authLoad(); }
  function authSave(a){
    _auth = a || null; _loaded = true;
    if (a) lsSet(K_AUTH, JSON.stringify(a)); else lsDel(K_AUTH);
    return _auth;
  }
  function authClear(){ authSave(null); }
  function token(){
    var a = cur();
    if (a && a.access_token && a.expires_at && Number(a.expires_at) * 1000 > Date.now() + 5000) return a.access_token;
    return null;
  }
  function isSignedIn(){ return !!token(); }
  function ensureFresh(){
    var a = cur();
    if (!a || !a.access_token) return Promise.resolve(false);
    if (Number(a.expires_at) * 1000 > Date.now() + 30000) return Promise.resolve(true);
    if (!a.refresh_token) return Promise.resolve(false);
    return global.fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: a.refresh_token })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.access_token) {
        authSave({
          access_token: j.access_token,
          refresh_token: j.refresh_token || a.refresh_token || null,
          expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
          email: (j.user && j.user.email) || a.email || null
        });
        return true;
      }
      return false;
    }).catch(function () { return false; });
  }

  /* ---- RPC: POST /rest/v1/rpc/<fn> ---- */
  function errMsg(txt, status){
    var m = '';
    try { var j = JSON.parse(txt); m = (j && (j.message || j.msg || j.error_description || j.error || j.hint)) || ''; } catch (e) {}
    return m || txt || ('Request failed (' + status + ')');
  }
  function rpc(fn, params, opts){
    var mode = (opts && opts.auth) || 'prefer';
    var p;
    if (mode === 'require') {
      p = ensureFresh().then(function (ok) {
        if (!ok) throw new Error('Please sign in.');
        return cur().access_token;
      });
    } else if (mode === 'anon') {
      p = Promise.resolve(null);
    } else {
      p = Promise.resolve(token());
    }
    return p.then(function (tk) {
      return global.fetch(BASE + '/rest/v1/rpc/' + fn, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + (tk || KEY), 'Content-Type': 'application/json' },
        body: JSON.stringify(params || {})
      });
    }).then(function (r) {
      return r.text().then(function (t) {
        if (!r.ok) throw new Error(errMsg(t, r.status));
        return t ? JSON.parse(t) : null;
      });
    });
  }

  /* ---- OTP sign-in (email 6-digit code) ---- */
  var otp = {
    send: function (email) {
      email = String(email || '').trim();
      return global.fetch(BASE + '/auth/v1/otp', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, create_user: true })
      }).then(function (r) {
        if (r.ok) { lsSet(K_PENDING, email); return true; }
        return r.json().catch(function () { return {}; }).then(function (j) {
          throw new Error(j.msg || j.error_description || j.error || j.message || 'Could not send the code.');
        });
      });
    },
    verify: function (email, code) {
      email = String(email || lsGet(K_PENDING) || '').trim();
      return global.fetch(BASE + '/auth/v1/verify', {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'email', email: email, token: String(code == null ? '' : code).trim() })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; });
      }).then(function (x) {
        var j = x.body || {};
        if (!x.ok || !j.access_token) throw new Error(j.msg || j.error_description || j.error || j.message || 'Wrong or expired code.');
        var sess = {
          access_token: j.access_token,
          refresh_token: j.refresh_token || null,
          expires_at: Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
          email: email,
          user_id: (j.user && j.user.id) || null
        };
        authSave(sess);
        lsDel(K_PENDING);
        return sess;
      });
    }
  };

  var ZoiCore = {
    version: '1.0.0',
    BASE: BASE,
    KEY: KEY,
    keys: { auth: K_AUTH, theme: K_THEME, pendingEmail: K_PENDING, workspace: K_WS },
    esc: esc,
    relTime: relTime,
    toast: toast,
    theme: theme,
    auth: { load: authLoad, save: authSave, clear: authClear, token: token, ensureFresh: ensureFresh, isSignedIn: isSignedIn },
    api: { rpc: rpc },
    otp: otp
  };

  global.ZoiCore = ZoiCore;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
