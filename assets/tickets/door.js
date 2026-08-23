/*!
 * door.js — Zoi Tickets: Door mode.
 * Classic script (NO ES modules). Zero dependencies. Depends only on
 * /assets/tickets/lib.js (ZoiTicketsLib) and /assets/tickets/qr.js is not
 * needed here — this side reads codes, it does not draw them.
 *
 * The brief: a volunteer holding one phone in a church hall with bad wifi, a
 * queue of people in front of them, and no training. So:
 *   - full screen, one thumb, everything important in the bottom third
 *   - camera QR scanning via BarcodeDetector where the browser has it, and a
 *     manual code entry that is always present and never smaller
 *   - one unmistakable answer per scan: green in, red already-in, amber held
 *     offline, grey not-on-the-list
 *   - a running checked-in / reserved counter, overall and per tier
 *   - if the request cannot reach the server the scan is QUEUED, and the words
 *     on screen say "not yet confirmed" — we never claim a check-in we did not
 *     get an answer for
 *
 * Colours here are deliberately fixed rather than themed: a door tool has to be
 * readable in a bright hall on a cheap screen, and "green means in" must not
 * change meaning between dark, light and gold. The chrome is camera-app black
 * in every theme.
 *
 * Public API (window.ZoiDoor):
 *   ZoiDoor.open({ eventId, eventName, whenText, reservations, checkin, reload,
 *                  toast, storage })
 *   ZoiDoor.close()
 *   ZoiDoor.isTransportError(err) -> boolean   (exported for tests/reuse)
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'tkxd-styles';
  var ROOT_ID = 'tkxdRoot';

  var S = null; // live door state, null when closed

  function L() { return global.ZoiTicketsLib; }
  function esc(s) { return L().esc(s); }

  /* ═════════════ transport vs server error ═════════════
   * Queueing is only honest for "we could not reach the server". A 4xx with a
   * message IS an answer and must be shown, not silently held. */
  function isTransportError(err) {
    if (!err) return false;
    if (err.transport === true) return true;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    var m = String(err.message || err).toLowerCase();
    return err instanceof TypeError
      || m.indexOf('failed to fetch') >= 0
      || m.indexOf('networkerror') >= 0
      || m.indexOf('network request failed') >= 0
      || m.indexOf('load failed') >= 0
      || m.indexOf('timeout') >= 0
      || m.indexOf('err_internet') >= 0;
  }

  /* ═════════════ styles ═════════════ */
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      '#' + ROOT_ID + '{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;',
      'background:#07080b;color:#f4f6f8;font-family:"Hanken Grotesk",system-ui,-apple-system,sans-serif;',
      'overscroll-behavior:contain;-webkit-text-size-adjust:100%}',
      '#' + ROOT_ID + ' *{box-sizing:border-box}',
      '.tkxd-bar{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#101318;',
      'border-bottom:1px solid #23282f;flex:none;padding-top:max(10px,env(safe-area-inset-top))}',
      '.tkxd-ttl{font-weight:800;font-size:15px;line-height:1.15;min-width:0;flex:1;',
      'overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.tkxd-ttl small{display:block;font-weight:600;font-size:11.5px;color:#9aa5b1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.tkxd-net{font:800 10.5px/1 "Hanken Grotesk",sans-serif;letter-spacing:.1em;text-transform:uppercase;',
      'padding:6px 9px;border-radius:999px;border:1px solid #2c333c;background:#161b21;color:#9aa5b1;flex:none}',
      '.tkxd-net[data-net="off"]{background:#3a2a05;border-color:#7a5c10;color:#ffd479}',
      '.tkxd-x{flex:none;width:46px;height:46px;border-radius:14px;border:1px solid #2c333c;background:#171c22;',
      'color:#f4f6f8;font-size:22px;line-height:1;cursor:pointer;display:grid;place-items:center}',
      '.tkxd-x:hover{background:#212831}',
      /* counters */
      '.tkxd-count{flex:none;padding:12px 14px 10px;background:#0b0e12;border-bottom:1px solid #1b2027}',
      '.tkxd-big{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.tkxd-big b{font-size:34px;font-weight:800;line-height:1;letter-spacing:-.02em}',
      '.tkxd-big span{font-size:13.5px;color:#9aa5b1;font-weight:600}',
      '.tkxd-prog{height:8px;border-radius:8px;background:#1d232b;overflow:hidden;margin-top:9px}',
      '.tkxd-prog i{display:block;height:100%;background:#2fa86a;border-radius:8px;transition:width .35s ease}',
      '.tkxd-tiers{display:flex;gap:7px;overflow-x:auto;margin-top:10px;padding-bottom:2px;scrollbar-width:none}',
      '.tkxd-tiers::-webkit-scrollbar{display:none}',
      '.tkxd-tier{flex:none;padding:6px 11px;border-radius:999px;background:#151a20;border:1px solid #262d36;',
      'font:700 12px/1.3 "Hanken Grotesk",sans-serif;white-space:nowrap}',
      '.tkxd-tier em{font-style:normal;color:#9aa5b1;font-weight:600}',
      /* stage */
      '.tkxd-stage{flex:1;min-height:0;position:relative;display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain}',
      /* camera on: the answer covers the viewfinder rather than scrolling away */
      '.tkxd-stage[data-scan="1"]{overflow:hidden}',
      '.tkxd-stage[data-scan="1"] .tkxd-res{position:absolute;inset:0;z-index:4;opacity:1;',
      'transition:opacity .12s ease,background .18s ease}',
      '.tkxd-stage[data-scan="1"] .tkxd-res[data-kind="idle"]{opacity:0;pointer-events:none}',
      '.tkxd-cam{position:relative;background:#000;flex:none;aspect-ratio:1/1;max-height:46vh;overflow:hidden;display:none}',
      '.tkxd-cam[data-on="1"]{display:block}',
      '.tkxd-cam video{width:100%;height:100%;object-fit:cover;display:block}',
      '.tkxd-retic{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}',
      '.tkxd-retic div{width:64%;aspect-ratio:1/1;border-radius:22px;box-shadow:0 0 0 9999px rgba(0,0,0,.42);',
      'border:3px solid rgba(255,255,255,.85)}',
      '.tkxd-camhint{position:absolute;left:0;right:0;bottom:8px;text-align:center;font:700 12px/1.4 "Hanken Grotesk",sans-serif;',
      'color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.9);padding:0 12px}',
      '.tkxd-torch{position:absolute;top:10px;right:10px;width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.4);',
      'background:rgba(0,0,0,.5);color:#fff;font-size:19px;cursor:pointer;display:none;place-items:center}',
      '.tkxd-torch[data-avail="1"]{display:grid}',
      /* result */
      '.tkxd-res{flex:1;min-height:150px;display:flex;flex-direction:column;justify-content:center;gap:6px;',
      'padding:20px 18px;text-align:center;background:#0d1116;transition:background .18s ease}',
      '.tkxd-res[data-kind="accepted"]{background:#0d6b3f}',
      '.tkxd-res[data-kind="duplicate"]{background:#96201a}',
      '.tkxd-res[data-kind="queued"]{background:#7a5410}',
      '.tkxd-res[data-kind="unknown"]{background:#2c333c}',
      '.tkxd-res[data-kind="error"]{background:#5c1a14}',
      '.tkxd-res[data-kind="busy"]{background:#12303f}',
      '.tkxd-res .k{font:800 11px/1 "Hanken Grotesk",sans-serif;letter-spacing:.22em;text-transform:uppercase;opacity:.85}',
      '.tkxd-res .h{font-size:clamp(24px,7vw,38px);font-weight:800;line-height:1.05;letter-spacing:-.02em;overflow-wrap:anywhere}',
      '.tkxd-res .d{font-size:14.5px;font-weight:600;opacity:.95;overflow-wrap:anywhere}',
      '.tkxd-res .w{font-size:13px;font-weight:600;opacity:.85;overflow-wrap:anywhere}',
      '.tkxd-res .code{font:700 13px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;opacity:.8}',
      '.tkxd-idle{color:#9aa5b1;font-size:14px;font-weight:600;line-height:1.5}',
      /* controls */
      '.tkxd-ctl{flex:none;padding:12px;background:#101318;border-top:1px solid #23282f;',
      'padding-bottom:max(12px,env(safe-area-inset-bottom))}',
      '.tkxd-form{display:flex;gap:8px}',
      '.tkxd-in{flex:1;min-width:0;height:60px;border-radius:16px;border:2px solid #333c47;background:#0a0d11;',
      'color:#fff;font:800 21px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;text-align:center;',
      'text-transform:uppercase;padding:0 12px}',
      '.tkxd-in::placeholder{color:#5d6874;letter-spacing:.08em;font-weight:600}',
      '.tkxd-in:focus{outline:none;border-color:#4f9be8;box-shadow:0 0 0 4px rgba(79,155,232,.25)}',
      /* the page themes every input with !important; the door is not themed */
      '#' + ROOT_ID + ' input.tkxd-in{background:#0a0d11!important;color:#ffffff!important;border:2px solid #333c47!important}',
      '#' + ROOT_ID + ' input.tkxd-in:focus{border-color:#4f9be8!important}',
      '#' + ROOT_ID + ' input.tkxd-in::placeholder{color:#5d6874!important}',
      '.tkxd-go{flex:none;width:104px;height:60px;border-radius:16px;border:none;background:#2fa86a;color:#04150c;',
      'font:800 16px/1 "Hanken Grotesk",sans-serif;cursor:pointer}',
      '.tkxd-go:disabled{opacity:.5;cursor:not-allowed}',
      '.tkxd-go:focus-visible,.tkxd-btn:focus-visible,.tkxd-x:focus-visible,.tkxd-torch:focus-visible,.tkxd-tab:focus-visible{',
      'outline:3px solid #ffd479;outline-offset:2px}',
      '.tkxd-row{display:flex;gap:8px;margin-top:9px;flex-wrap:wrap}',
      '.tkxd-btn{flex:1 1 auto;min-width:104px;min-height:48px;border-radius:14px;border:1px solid #2c333c;',
      'background:#171c22;color:#e8ecf1;font:700 13.5px/1.2 "Hanken Grotesk",sans-serif;cursor:pointer;',
      'display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 12px}',
      '.tkxd-btn:hover{background:#212831}',
      '.tkxd-btn[aria-pressed="true"]{background:#1d3a52;border-color:#3f6f96;color:#dbeaf7}',
      '.tkxd-btn b{background:#0a0d11;border:1px solid #2c333c;border-radius:6px;padding:1px 5px;font-size:11px}',
      '.tkxd-badge{background:#7a5410;border-color:#a97a1c;color:#ffe6ad}',
      /* queue + help sheets */
      '.tkxd-sheet{position:absolute;inset:0;background:#0b0e12;z-index:5;display:none;flex-direction:column}',
      '.tkxd-sheet[data-open="1"]{display:flex}',
      '.tkxd-sheet header{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #1b2027;flex:none}',
      '.tkxd-sheet header h3{font-size:16px;font-weight:800;flex:1;margin:0}',
      '.tkxd-sheet .body{flex:1;overflow-y:auto;padding:12px 14px 20px}',
      '.tkxd-q{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:12px;background:#141920;',
      'border:1px solid #232a33;margin-bottom:8px}',
      '.tkxd-q .c{font:800 15px/1 ui-monospace,Menlo,monospace;letter-spacing:.1em}',
      '.tkxd-q .m{font-size:11.5px;color:#9aa5b1;margin-top:3px}',
      '.tkxd-q .sp{flex:1;min-width:0}',
      '.tkxd-mini{min-height:38px;padding:0 12px;border-radius:10px;border:1px solid #2c333c;background:#1b212a;',
      'color:#e8ecf1;font:700 12.5px/1 "Hanken Grotesk",sans-serif;cursor:pointer;flex:none}',
      '.tkxd-mini:hover{background:#242c36}',
      '.tkxd-note{font-size:12.5px;line-height:1.55;color:#a9b4c0;background:#141920;border:1px solid #232a33;',
      'border-radius:12px;padding:11px 13px;margin-bottom:12px}',
      '.tkxd-note b{color:#ffd479}',
      '.tkxd-kbd{display:grid;grid-template-columns:auto 1fr;gap:8px 12px;font-size:13.5px;align-items:center}',
      '.tkxd-kbd kbd{background:#0a0d11;border:1px solid #333c47;border-radius:7px;padding:3px 8px;',
      'font:700 12px/1 ui-monospace,Menlo,monospace;justify-self:start}',
      '@media(min-width:820px){',
      '.tkxd-cam{aspect-ratio:16/9;max-height:52vh}',
      '.tkxd-res .h{font-size:42px}',
      '}',
      '@media(prefers-reduced-motion:reduce){#' + ROOT_ID + ' *{transition:none!important;animation:none!important}}'
    ].join('');
    var el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  /* ═════════════ feedback ═════════════ */
  function buzz(kind) {
    if (!S || !S.haptics) return;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(kind === 'accepted' ? 45
          : kind === 'duplicate' ? [70, 60, 70]
            : kind === 'queued' ? [30, 40, 30] : 140);
      }
    } catch (e) { /* vibration is a nicety, never a failure */ }
  }

  function beep(kind) {
    if (!S || !S.sound) return;
    try {
      var Ctx = global.AudioContext || global.webkitAudioContext;
      if (!Ctx) return;
      S.actx = S.actx || new Ctx();
      var t = S.actx.currentTime;
      var freqs = kind === 'accepted' ? [880, 1320] : kind === 'duplicate' ? [300, 220] : [520];
      freqs.forEach(function (f, i) {
        var o = S.actx.createOscillator();
        var g = S.actx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.11);
        g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.11 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.1);
        o.connect(g); g.connect(S.actx.destination);
        o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.12);
      });
    } catch (e) { /* audio blocked before a gesture — fine */ }
  }

  /* ═════════════ render ═════════════ */
  function q(sel) { return S && S.root ? S.root.querySelector(sel) : null; }

  function paintCounts() {
    if (!S) return;
    var c = L().doorCounts(S.reservations);
    S.counts = c;
    var big = q('#tkxdBig');
    if (big) {
      big.innerHTML = '<b>' + c.checkedIn + '</b><span>checked in of <b style="font-size:19px">'
        + c.sold + '</b> reserved · ' + c.remaining + ' to go</span>';
    }
    var pr = q('#tkxdProg i');
    if (pr) pr.style.width = c.pct + '%';
    var tw = q('#tkxdTiers');
    if (tw) {
      tw.innerHTML = c.tiers.length
        ? c.tiers.map(function (t) {
          return '<span class="tkxd-tier">' + esc(t.name) + ' <em>' + t.checkedIn + '/' + t.sold + '</em></span>';
        }).join('')
        : '<span class="tkxd-tier"><em>No reservations on the list yet</em></span>';
    }
  }

  function paintQueueBadge() {
    if (!S) return;
    var n = L().Queue.counts(S.queue);
    var b = q('#tkxdQueueBtn');
    if (b) {
      b.textContent = n.total ? 'Held offline ' : 'Held offline';
      var strong = document.createElement('b');
      strong.textContent = String(n.total);
      b.appendChild(strong);
      b.classList.toggle('tkxd-badge', n.total > 0);
      b.setAttribute('aria-label', n.total + ' scans held on this device, not yet confirmed');
    }
    var net = q('#tkxdNet');
    if (net) {
      var off = (typeof navigator !== 'undefined' && navigator.onLine === false);
      net.setAttribute('data-net', off ? 'off' : 'on');
      net.textContent = off ? 'Offline' : 'Online';
    }
  }

  function paintQueueSheet() {
    if (!S) return;
    var body = q('#tkxdQueueBody');
    if (!body) return;
    var items = L().Queue.normalize(S.queue).items;
    var note = '<div class="tkxd-note">Scans land here when the phone cannot reach the ticket server. '
      + 'They are <b>held on this device and not yet confirmed</b> — Zoi retries automatically, and you can '
      + 'retry by hand. Nothing here has been recorded against the event yet. Do not close this tab until the list is empty.</div>';
    if (!items.length) {
      body.innerHTML = note + '<div class="tkxd-idle">Nothing held. Every scan so far got an answer from the server.</div>';
      return;
    }
    body.innerHTML = note + items.map(function (it) {
      var when = new Date(it.queuedAt);
      var meta = 'scanned ' + (isNaN(when.getTime()) ? 'recently' : when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' }))
        + ' · ' + it.attempts + ' ' + L().plural(it.attempts, 'attempt')
        + (it.status === 'stuck' ? ' · gave up retrying' : '')
        + (it.lastError ? ' · ' + esc(it.lastError) : '');
      return '<div class="tkxd-q"><div class="sp"><div class="c">' + esc(it.code) + '</div>'
        + '<div class="m">' + meta + '</div></div>'
        + (it.status === 'stuck'
          ? '<button class="tkxd-mini" data-qretry="' + it.id + '">Retry</button>' : '')
        + '<button class="tkxd-mini" data-qdrop="' + it.id + '">Remove</button></div>';
    }).join('');
  }

  function showResult(kind, html, code) {
    var res = q('#tkxdRes');
    if (!res) return;
    res.setAttribute('data-kind', kind);
    res.innerHTML = html + (code ? '<div class="code">' + esc(code) + '</div>' : '');
    buzz(kind);
    beep(kind);
    clearTimeout(S.resetTimer);
    if (kind !== 'busy') {
      S.resetTimer = setTimeout(idleResult, 9000);
    }
  }

  function idleResult() {
    var res = q('#tkxdRes');
    if (!res) return;
    res.setAttribute('data-kind', 'idle');
    res.innerHTML = '<div class="tkxd-idle">'
      + (S.scanning
        ? 'Point the camera at the ticket QR code.'
        : (S.detectorAvailable
          ? 'Tap <b>Scan QR</b> to use the camera, or type a code below.'
          : 'This browser has no built-in QR scanner (<b>BarcodeDetector</b> is missing — usual on iOS Safari '
            + 'and Firefox), so the camera button is hidden. Type the code below: it checks people in exactly '
            + 'the same way.'))
      + '</div>';
  }

  /* ═════════════ check-in ═════════════ */
  function announce(text) {
    var live = q('#tkxdLive');
    if (live) live.textContent = text;
  }

  function submit(rawCode, fromCamera) {
    var lib = L();
    var code = lib.normalizeCode(rawCode);
    if (!code) {
      showResult('error', '<div class="k">No code</div><div class="h">Nothing to check</div>'
        + '<div class="d">Type or scan a confirmation code.</div>');
      announce('No code entered.');
      return Promise.resolve();
    }
    var now = Date.now();
    if (fromCamera && S.lastScan.code === code && now - S.lastScan.at < 2600) return Promise.resolve();
    S.lastScan = { code: code, at: now };
    if (S.busy) return Promise.resolve();
    S.busy = true;
    var go = q('#tkxdGo'); if (go) go.disabled = true;
    showResult('busy', '<div class="k">Checking</div><div class="h">' + esc(code) + '</div>'
      + '<div class="d">Asking the ticket server…</div>');
    announce('Checking ' + code);

    return S.checkin(code).then(function (response) {
      if (!S) return;
      if (response == null || typeof response !== 'object') {
        // The server answered, but with nothing we can read. That is neither a
        // check-in nor an outage, so we must not pretend it is either.
        showResult('error',
          '<div class="k">Unreadable answer</div><div class="h">Try again</div>'
          + '<div class="d">The ticket server replied with nothing we can read.</div>'
          + '<div class="w">Nothing has been recorded and nothing was queued. '
          + 'Scan again, or check them in from the attendee list.</div>', code);
        announce('The server sent an unreadable answer. Nothing was recorded.');
        return;
      }
      apply(lib.decide({ response: response }), code, response);
    }).catch(function (err) {
      if (!S) return;
      if (isTransportError(err)) {
        var r = lib.Queue.enqueue(S.queue, code, Date.now());
        S.queue = r.state;
        persistQueue();
        paintQueueBadge();
        paintQueueSheet();
        apply(lib.decide({ error: err }), code, null, r.duplicate);
        scheduleDrain(800);
      } else {
        showResult('error', '<div class="k">Server said no</div><div class="h">Could not check in</div>'
          + '<div class="d">' + esc(err && err.message ? err.message : 'Unknown error') + '</div>'
          + '<div class="w">This is an answer from the server, not a connection problem — it has NOT been queued.</div>', code);
        announce('Error: ' + (err && err.message ? err.message : 'unknown'));
      }
    }).then(function () {
      if (!S) return;
      S.busy = false;
      var g2 = q('#tkxdGo'); if (g2) g2.disabled = false;
      var inp = q('#tkxdIn');
      if (inp) { inp.value = ''; if (!S.scanning) inp.focus(); }
    });
  }

  function apply(d, code, response, alreadyQueued) {
    if (d.kind === 'accepted') {
      markLocal(code, response);
      paintCounts();
      showResult('accepted',
        '<div class="k">Welcome in</div><div class="h">' + esc(d.who) + '</div>'
        + '<div class="d">' + esc(d.detail) + '</div>', code);
      announce('Checked in: ' + d.who + ', ' + d.detail);
    } else if (d.kind === 'duplicate') {
      showResult('duplicate',
        '<div class="k">Already checked in</div><div class="h">' + esc(d.who) + '</div>'
        + '<div class="d">' + esc(d.detail) + '</div>'
        + '<div class="w">' + (d.whenText
          ? 'Checked in at ' + esc(d.whenText) + '.'
          : 'The server did not report the time, so we are not going to guess it.')
        + ' Do not let a second group in on this code.</div>', code);
      announce('Already checked in: ' + d.who);
    } else if (d.kind === 'unknown') {
      showResult('unknown',
        '<div class="k">Not on the list</div><div class="h">Code not recognised</div>'
        + '<div class="d">Check for a typo, or search the attendee list for their name.</div>', code);
      announce('Code not recognised.');
    } else if (d.kind === 'queued') {
      showResult('queued',
        '<div class="k">Held offline</div><div class="h">' + (alreadyQueued ? 'Already waiting' : 'Saved on this phone') + '</div>'
        + '<div class="d">No connection to the ticket server.</div>'
        + '<div class="w">This is <b>not confirmed</b> — Zoi will retry automatically. '
        + 'Use your judgement on whether to let them in.</div>', code);
      announce('Offline. Scan held on this device, not confirmed.');
    } else {
      showResult('error', '<div class="k">No code</div><div class="h">Nothing to check</div>', code);
    }
  }

  /**
   * Reflect a confirmed check-in in the local list so the counter moves without
   * a round trip. Only ever called after the server said yes.
   */
  function markLocal(code, response) {
    if (!S) return;
    var hit = false;
    var want = L().compactCode(code);
    for (var i = 0; i < S.reservations.length; i++) {
      var r = S.reservations[i];
      // Compare without punctuation: an exact match added a phantom row every
      // time the server's idea of the code differed by a hyphen, which
      // permanently inflated both counters.
      if (want && L().compactCode(r.code) === want) { r.checked_in = true; hit = true; }
    }
    if (!hit && response && response.name) {
      // The row is not in the list we loaded (someone reserved after we opened
      // door mode). Add it so the counter stays truthful rather than stale.
      S.reservations.push({
        name: response.name, email: response.email || '', type: response.type || '',
        code: code, qty: response.qty || 1, paid: !!response.paid, checked_in: true
      });
    }
  }

  /* ═════════════ offline queue drain ═════════════ */
  function persistQueue() {
    if (S.storage) L().Queue.save(S.storage, S.storageKey, S.queue);
  }

  function scheduleDrain(delay) {
    clearTimeout(S.drainTimer);
    S.drainTimer = setTimeout(drain, delay == null ? 3000 : delay);
  }

  function drain() {
    if (!S || S.draining) return;
    var lib = L();
    var item = lib.Queue.due(S.queue, Date.now());
    if (!item) {
      if (lib.Queue.pending(S.queue).length) scheduleDrain(2000);
      return;
    }
    S.draining = true;
    S.checkin(item.code).then(function (response) {
      if (!S) return;
      if (response == null || typeof response !== 'object') {
        // Keep it queued: an unreadable answer is not a confirmation.
        S.queue = lib.Queue.fail(S.queue, item.id, 'unreadable answer', Date.now());
        return;
      }
      var d = lib.decide({ response: response });
      if (d.kind !== 'accepted' && d.kind !== 'duplicate' && d.kind !== 'unknown') {
        S.queue = lib.Queue.fail(S.queue, item.id, 'no usable answer', Date.now());
        return;
      }
      S.queue = lib.Queue.done(S.queue, item.id);
      if (d.kind === 'accepted') markLocal(item.code, response);
      paintCounts();
      if (S.toast) {
        S.toast(d.kind === 'accepted' ? ('Synced: ' + (d.who || item.code) + ' checked in')
          : d.kind === 'duplicate' ? ('Synced: ' + item.code + ' was already checked in')
            : ('Synced: ' + item.code + ' is not on the list'));
      }
    }).catch(function (err) {
      if (!S) return;
      if (isTransportError(err)) {
        S.queue = lib.Queue.fail(S.queue, item.id, 'no connection', Date.now());
      } else {
        S.queue = lib.Queue.fail(S.queue, item.id, (err && err.message) || 'rejected', Date.now());
      }
    }).then(function () {
      if (!S) return;
      S.draining = false;
      persistQueue();
      paintQueueBadge();
      paintQueueSheet();
      var counts = lib.Queue.counts(S.queue);
      if (counts.pending) scheduleDrain(1200);
    });
  }

  /* ═════════════ camera ═════════════ */
  function detectorAvailable() {
    return typeof global.BarcodeDetector === 'function';
  }

  function startCamera() {
    if (S.scanning) return;
    var cam = q('#tkxdCam');
    var hint = q('#tkxdCamHint');
    if (!detectorAvailable()) {
      if (S.toast) S.toast('This browser has no QR scanner — type the code instead', true);
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (S.toast) S.toast('No camera access in this browser — type the code instead', true);
      return;
    }
    cam.setAttribute('data-on', '1');
    S.scanning = true;
    setScanBtn();
    if (hint) hint.textContent = 'Starting camera…';
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    }).then(function (stream) {
      S.stream = stream;
      var v = q('#tkxdVideo');
      v.srcObject = stream;
      v.setAttribute('playsinline', '');
      v.muted = true;
      var p = v.play();
      if (p && p.catch) p.catch(function () { });
      if (hint) hint.textContent = 'Hold the QR code inside the frame';
      var track = stream.getVideoTracks()[0];
      var caps = (track && track.getCapabilities) ? track.getCapabilities() : {};
      var torch = q('#tkxdTorch');
      if (torch) torch.setAttribute('data-avail', caps && caps.torch ? '1' : '0');
      try { S.detector = new global.BarcodeDetector({ formats: ['qr_code'] }); }
      catch (e) { S.detector = new global.BarcodeDetector(); }
      idleResult();
      loop();
    }).catch(function (err) {
      S.scanning = false;
      cam.setAttribute('data-on', '0');
      setScanBtn();
      var why = (err && err.name === 'NotAllowedError')
        ? 'Camera permission was declined. Type the code instead — it works the same.'
        : 'Could not start the camera (' + esc((err && err.name) || 'unknown') + '). Type the code instead.';
      showResult('unknown', '<div class="k">No camera</div><div class="h">Type the code</div><div class="d">' + why + '</div>');
      var inp = q('#tkxdIn'); if (inp) inp.focus();
    });
  }

  function loop() {
    if (!S || !S.scanning) return;
    var v = q('#tkxdVideo');
    var now = Date.now();
    if (v && v.readyState >= 2 && S.detector && !S.detecting && now - S.lastDetect > 110) {
      S.detecting = true;
      S.lastDetect = now;
      S.detector.detect(v).then(function (codes) {
        S.detecting = false;
        if (codes && codes.length) submit(codes[0].rawValue, true);
      }).catch(function () { S.detecting = false; });
    }
    S.raf = global.requestAnimationFrame(loop);
  }

  function stopCamera() {
    S.scanning = false;
    if (S.raf) global.cancelAnimationFrame(S.raf);
    if (S.stream) {
      S.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { } });
      S.stream = null;
    }
    var v = q('#tkxdVideo'); if (v) v.srcObject = null;
    var cam = q('#tkxdCam'); if (cam) cam.setAttribute('data-on', '0');
    setScanBtn();
    idleResult();
  }

  function setScanBtn() {
    var stage = q('#tkxdStage');
    if (stage) stage.setAttribute('data-scan', S.scanning ? '1' : '0');
    var b = q('#tkxdScanBtn');
    if (!b) return;
    b.setAttribute('aria-pressed', S.scanning ? 'true' : 'false');
    b.firstChild.nodeValue = S.scanning ? 'Stop camera ' : 'Scan QR ';
  }

  function toggleTorch() {
    if (!S.stream) return;
    var track = S.stream.getVideoTracks()[0];
    if (!track || !track.applyConstraints) return;
    S.torch = !S.torch;
    track.applyConstraints({ advanced: [{ torch: S.torch }] }).catch(function () {
      S.torch = false;
      if (S.toast) S.toast('This camera will not let the browser control the torch', true);
    });
  }

  /* ═════════════ sheets ═════════════ */
  function openSheet(id) {
    ['tkxdQueue', 'tkxdHelp'].forEach(function (s) {
      var el = q('#' + s);
      if (el) el.setAttribute('data-open', s === id ? '1' : '0');
    });
    if (id === 'tkxdQueue') paintQueueSheet();
    var first = q('#' + id + ' header button');
    if (first) first.focus();
  }
  function closeSheets() {
    ['tkxdQueue', 'tkxdHelp'].forEach(function (s) {
      var el = q('#' + s); if (el) el.setAttribute('data-open', '0');
    });
  }
  function sheetOpen() {
    return ['tkxdQueue', 'tkxdHelp'].some(function (s) {
      var el = q('#' + s); return el && el.getAttribute('data-open') === '1';
    });
  }

  /* ═════════════ open / close ═════════════ */
  function open(cfg) {
    if (!L()) throw new Error('ZoiDoor needs /assets/tickets/lib.js');
    if (S) close();
    injectStyles();
    cfg = cfg || {};
    var storage = cfg.storage === undefined ? tryStorage() : cfg.storage;
    var key = 'zoi_door_queue_' + (cfg.eventId || 'unknown');

    S = {
      eventId: cfg.eventId || null,
      eventName: cfg.eventName || 'Event',
      whenText: cfg.whenText || '',
      reservations: (cfg.reservations || []).slice(),
      checkin: cfg.checkin || function () { return Promise.reject(new Error('no check-in handler')); },
      reload: cfg.reload || null,
      toast: cfg.toast || null,
      storage: storage,
      storageKey: key,
      queue: storage ? L().Queue.load(storage, key) : L().Queue.create(),
      scanning: false, detecting: false, busy: false, draining: false,
      lastDetect: 0, lastScan: { code: '', at: 0 },
      haptics: true, sound: true, torch: false,
      detectorAvailable: detectorAvailable(),
      prevFocus: document.activeElement,
      prevOverflow: document.body.style.overflow
    };

    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('tabindex', '-1');
    root.setAttribute('aria-label', 'Door mode — check in guests for ' + S.eventName);
    root.innerHTML = template(S);
    document.body.appendChild(root);
    document.body.style.overflow = 'hidden';
    S.root = root;

    wire();
    paintCounts();
    paintQueueBadge();
    idleResult();
    var inp = q('#tkxdIn');
    if (inp) inp.focus();
    if (L().Queue.pending(S.queue).length) scheduleDrain(600);
    return S;
  }

  function tryStorage() {
    try {
      var k = '__tkxd_probe';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return global.localStorage;
    } catch (e) { return null; }
  }

  function template(s) {
    return ''
      + '<div class="tkxd-bar">'
      + '<div class="tkxd-ttl">' + esc(s.eventName) + '<small>Door mode' + (s.whenText ? ' · ' + esc(s.whenText) : '') + '</small></div>'
      + '<span class="tkxd-net" id="tkxdNet" data-net="on">Online</span>'
      + '<button class="tkxd-x" id="tkxdClose" aria-label="Leave door mode (Esc)">&#10005;</button>'
      + '</div>'
      + '<div class="tkxd-count">'
      + '<div class="tkxd-big" id="tkxdBig"></div>'
      + '<div class="tkxd-prog" id="tkxdProg" role="img" aria-label="Check-in progress"><i style="width:0%"></i></div>'
      + '<div class="tkxd-tiers" id="tkxdTiers"></div>'
      + '</div>'
      + '<div class="tkxd-stage" id="tkxdStage" data-scan="0">'
      + '<div class="tkxd-cam" id="tkxdCam" data-on="0">'
      + '<video id="tkxdVideo" playsinline muted></video>'
      + '<div class="tkxd-retic"><div></div></div>'
      + '<button class="tkxd-torch" id="tkxdTorch" data-avail="0" aria-label="Toggle camera torch (L)">&#9788;</button>'
      + '<div class="tkxd-camhint" id="tkxdCamHint"></div>'
      + '</div>'
      + '<div class="tkxd-res" id="tkxdRes" data-kind="idle"></div>'
      + '<div id="tkxdLive" aria-live="assertive" aria-atomic="true" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap"></div>'
      + '<section class="tkxd-sheet" id="tkxdQueue" data-open="0" aria-label="Scans held offline">'
      + '<header><h3>Held offline</h3><button class="tkxd-mini" data-close-sheet="1">Done</button></header>'
      + '<div class="body" id="tkxdQueueBody"></div></section>'
      + '<section class="tkxd-sheet" id="tkxdHelp" data-open="0" aria-label="Door mode help">'
      + '<header><h3>How door mode works</h3><button class="tkxd-mini" data-close-sheet="1">Done</button></header>'
      + '<div class="body">'
      + '<div class="tkxd-note">Green means the server confirmed a first check-in. Red means that code was '
      + '<b>already used</b>. Amber means the phone could not reach the server and the scan is <b>held on this '
      + 'device, not confirmed</b>. Grey means the code is not on the list for your events.</div>'
      + '<div class="tkxd-note">There is no un-check-in: the backend has no RPC to reverse a confirmed check-in, '
      + 'so Zoi will not pretend to offer one. You can remove a scan that is still <b>held offline</b>, because '
      + 'that one has not reached the server yet.</div>'
      + '<div class="tkxd-kbd">'
      + '<kbd>Enter</kbd><span>Check in the typed code</span>'
      + '<kbd>/</kbd><span>Jump to the code box</span>'
      + '<kbd>S</kbd><span>Start / stop the camera</span>'
      + '<kbd>L</kbd><span>Camera torch (if the phone allows it)</span>'
      + '<kbd>Q</kbd><span>Scans held offline</span>'
      + '<kbd>R</kbd><span>Reload the attendee list</span>'
      + '<kbd>?</kbd><span>This help</span>'
      + '<kbd>Esc</kbd><span>Clear the box, step out of it, then leave door mode</span>'
      + '<div style="grid-column:1/-1;font-size:12px;color:#9aa5b1;line-height:1.5">'
      + 'Single letters only work when the code box does <b>not</b> have focus, because S and Q are legal '
      + 'characters in a code. Press <b>Esc</b> to step out of the box, or just use the buttons — every '
      + 'shortcut has one.</div>'
      + '</div></div></section>'
      + '</div>'
      + '<div class="tkxd-ctl">'
      + '<form class="tkxd-form" id="tkxdForm" autocomplete="off">'
      + '<label for="tkxdIn" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Confirmation code</label>'
      + '<input class="tkxd-in" id="tkxdIn" inputmode="latin" autocapitalize="characters" autocomplete="off" '
      + 'spellcheck="false" placeholder="CODE" aria-describedby="tkxdCtlHint"/>'
      + '<button class="tkxd-go" id="tkxdGo" type="submit">Check in</button>'
      + '</form>'
      + '<div class="tkxd-row">'
      + (s.detectorAvailable ? '<button class="tkxd-btn" id="tkxdScanBtn" aria-pressed="false">Scan QR <b>S</b></button>' : '')
      + '<button class="tkxd-btn" id="tkxdQueueBtn">Held offline<b>0</b></button>'
      + '<button class="tkxd-btn" id="tkxdReload">Refresh <b>R</b></button>'
      + '<button class="tkxd-btn" id="tkxdHelpBtn" aria-label="Door mode help">Help <b>?</b></button>'
      + '</div>'
      + '<div id="tkxdCtlHint" style="font-size:11.5px;color:#7d8792;margin-top:8px;line-height:1.45">'
      + 'Codes are matched exactly as printed on the confirmation. Counters above come from this event’s '
      + 'reservation list — nothing here is estimated. Press Esc to leave the code box and use letter shortcuts.</div>'
      + '</div>';
  }

  function wire() {
    var root = S.root;

    q('#tkxdClose').addEventListener('click', requestClose);
    q('#tkxdForm').addEventListener('submit', function (e) {
      e.preventDefault();
      submit(q('#tkxdIn').value, false);
    });
    var scanBtn = q('#tkxdScanBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', function () {
        if (S.scanning) stopCamera(); else startCamera();
      });
      setScanBtn();
    }
    q('#tkxdTorch').addEventListener('click', toggleTorch);
    q('#tkxdQueueBtn').addEventListener('click', function () { openSheet('tkxdQueue'); });
    q('#tkxdHelpBtn').addEventListener('click', function () { openSheet('tkxdHelp'); });
    q('#tkxdReload').addEventListener('click', reload);

    root.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-close-sheet],[data-qdrop],[data-qretry]') : null;
      if (!t) return;
      if (t.hasAttribute('data-close-sheet')) { closeSheets(); var i = q('#tkxdIn'); if (i) i.focus(); return; }
      if (t.hasAttribute('data-qdrop')) {
        S.queue = L().Queue.drop(S.queue, Number(t.getAttribute('data-qdrop')));
        persistQueue(); paintQueueBadge(); paintQueueSheet();
        if (S.toast) S.toast('Removed from the offline queue — it was never sent');
        return;
      }
      if (t.hasAttribute('data-qretry')) {
        S.queue = L().Queue.revive(S.queue, Number(t.getAttribute('data-qretry')), Date.now());
        persistQueue(); paintQueueBadge(); paintQueueSheet(); scheduleDrain(50);
      }
    });

    S.onKey = function (e) {
      if (!S) return;
      var typing = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
      if (e.key === 'Escape') {
        e.preventDefault();
        if (sheetOpen()) { closeSheets(); var i = q('#tkxdIn'); if (i) i.focus(); return; }
        var inp = q('#tkxdIn');
        if (inp && document.activeElement === inp) {
          // Escape in the code box: clear a mistyped code, then step out to the
          // shortcut layer. Letter shortcuts cannot fire while the box has focus
          // (S is a legal character in a code), so there has to be a way out.
          if (inp.value) { inp.value = ''; announce('Code cleared'); return; }
          inp.blur();
          if (S.root) S.root.focus();
          announce('Shortcut mode. Press slash to go back to the code box.');
          return;
        }
        requestClose();
        return;
      }
      if (typing) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave the browser's own keys alone
      var k = e.key.toLowerCase();
      if (k === '/') { e.preventDefault(); var inp = q('#tkxdIn'); if (inp) { inp.focus(); inp.select(); } }
      else if (k === 's') { e.preventDefault(); if (S.scanning) stopCamera(); else startCamera(); }
      else if (k === 'l') { e.preventDefault(); toggleTorch(); }
      else if (k === 'q') { e.preventDefault(); if (sheetOpen()) closeSheets(); else openSheet('tkxdQueue'); }
      else if (k === 'r') { e.preventDefault(); reload(); }
      else if (k === '?' || (e.shiftKey && k === '/')) { e.preventDefault(); openSheet('tkxdHelp'); }
    };
    document.addEventListener('keydown', S.onKey, true);

    S.onOnline = function () { paintQueueBadge(); scheduleDrain(300); };
    S.onOffline = function () { paintQueueBadge(); };
    global.addEventListener('online', S.onOnline);
    global.addEventListener('offline', S.onOffline);

    // Keep focus inside the dialog.
    S.onFocus = function (e) {
      if (!S || !S.root) return;
      if (!S.root.contains(e.target)) {
        var i = q('#tkxdIn'); if (i) i.focus();
      }
    };
    document.addEventListener('focusin', S.onFocus);
  }

  function reload() {
    if (!S.reload) { if (S.toast) S.toast('Nothing to reload from here', true); return; }
    var b = q('#tkxdReload');
    if (b) { b.disabled = true; }
    Promise.resolve(S.reload()).then(function (rows) {
      if (!S) return;
      if (Array.isArray(rows)) { S.reservations = rows.slice(); paintCounts(); }
      if (S.toast) S.toast('Attendee list refreshed');
    }).catch(function (e) {
      if (S && S.toast) S.toast('Could not refresh: ' + ((e && e.message) || 'unknown'), true);
    }).then(function () { if (b && b.isConnected) b.disabled = false; });
  }

  function requestClose() {
    var n = L().Queue.counts(S.queue);
    if (n.total) {
      openSheet('tkxdQueue');
      if (S.toast) {
        S.toast(n.total + ' ' + L().plural(n.total, 'scan') + ' still held offline — they are not confirmed yet', true);
      }
      var again = q('#tkxdQueueBody');
      if (again && !again.querySelector('[data-force-close]')) {
        var btn = document.createElement('button');
        btn.className = 'tkxd-mini';
        btn.setAttribute('data-force-close', '1');
        btn.style.marginTop = '12px';
        btn.textContent = 'Leave door mode anyway (the queue stays on this device)';
        btn.addEventListener('click', close);
        again.appendChild(btn);
      }
      return;
    }
    close();
  }

  function close() {
    if (!S) return;
    stopCamera();
    clearTimeout(S.resetTimer);
    clearTimeout(S.drainTimer);
    document.removeEventListener('keydown', S.onKey, true);
    document.removeEventListener('focusin', S.onFocus);
    global.removeEventListener('online', S.onOnline);
    global.removeEventListener('offline', S.onOffline);
    persistQueue();
    if (S.actx && S.actx.close) { try { S.actx.close(); } catch (e) { } }
    document.body.style.overflow = S.prevOverflow || '';
    if (S.root && S.root.parentNode) S.root.parentNode.removeChild(S.root);
    var prev = S.prevFocus;
    S = null;
    if (prev && prev.focus) { try { prev.focus(); } catch (e) { } }
  }

  global.ZoiDoor = {
    open: open,
    close: close,
    isTransportError: isTransportError,
    isOpen: function () { return !!S; },
    _state: function () { return S; }
  };
}(typeof window !== 'undefined' ? window : globalThis));
