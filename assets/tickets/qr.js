/*!
 * qr.js — Zoi Tickets: QR Code encoder (ISO/IEC 18004), byte mode.
 * Classic script (NO ES modules). Zero dependencies. No network.
 *
 * WHY THIS EXISTS: the rest of the site renders QR codes with a third-party
 * <img src="api.qrserver.com/...?data=..."> which (a) posts the payload to
 * someone else's server and (b) is a blank box the moment wifi drops. A door
 * volunteer's phone and an attendee's ticket both need to work offline, and a
 * confirmation code is not ours to hand to a stranger. So we encode locally.
 *
 * Public API (window.ZoiQR):
 *   ZoiQR.encode(text, opts) -> { size, version, ecc, mask, modules:Uint8Array }
 *        modules[y*size + x] === 1 means "dark". opts = {ecc:'L'|'M'|'Q'|'H',
 *        minVersion, maxVersion, mask (0-7, else auto)}
 *   ZoiQR.svg(text, opts) -> SVG string (opts.scale, opts.quiet, opts.dark,
 *        opts.light, opts.title)
 *   ZoiQR.toCanvas(canvas, text, opts) -> the canvas, painted.
 *
 * Supports versions 1-10 (up to 213 bytes at ECC M) which covers every payload
 * this product produces: confirmation codes and https://zoi.city/... links.
 */
(function (global) {
  'use strict';

  /* ── error-correction tables (ISO/IEC 18004 tables 13-22), versions 1-10 ── */
  var ECC_LEVELS = { L: 0, M: 1, Q: 2, H: 3 };
  // format-info indicator bits per level, in spec order (L=01, M=00, Q=11, H=10)
  var ECC_FORMAT_BITS = [1, 0, 3, 2];

  // ECC codewords per block, indexed [level][version]; index 0 is unused.
  var ECC_PER_BLOCK = [
    [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28]
  ];
  // number of ECC blocks, indexed [level][version].
  var ECC_BLOCKS = [
    [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8]
  ];
  var MIN_VERSION = 1;
  var MAX_VERSION = 10;

  /* ── GF(256) arithmetic, primitive polynomial 0x11D ── */
  function gfMul(a, b) {
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = ((z << 1) ^ ((z >>> 7) * 0x11D)) & 0xFF;
      z ^= ((b >>> i) & 1) * a;
    }
    return z & 0xFF;
  }

  /** Reed-Solomon generator polynomial coefficients (monic, leading term dropped). */
  function rsDivisor(degree) {
    var result = [];
    var i;
    for (i = 0; i < degree; i++) result.push(0);
    result[degree - 1] = 1;
    var root = 1;
    for (i = 0; i < degree; i++) {
      for (var j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }

  function rsRemainder(data, divisor) {
    var result = [];
    var i;
    for (i = 0; i < divisor.length; i++) result.push(0);
    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ result.shift();
      result.push(0);
      for (var j = 0; j < divisor.length; j++) {
        result[j] ^= gfMul(divisor[j], factor);
      }
    }
    return result;
  }

  /* ── capacity maths ── */
  function rawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  /** Data codewords available (total codewords minus ECC codewords). */
  function dataCodewords(ver, eccIdx) {
    return Math.floor(rawDataModules(ver) / 8)
      - ECC_PER_BLOCK[eccIdx][ver] * ECC_BLOCKS[eccIdx][ver];
  }

  function alignmentPositions(ver) {
    if (ver === 1) return [];
    var numAlign = Math.floor(ver / 7) + 2;
    var step = Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    var result = [6];
    for (var pos = ver * 4 + 10; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  /* ── UTF-8 bytes ── */
  function utf8Bytes(str) {
    var s = String(str);
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0x10000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else {
        out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  /* ── bit buffer ── */
  function BitBuf() { this.bits = []; }
  BitBuf.prototype.push = function (val, len) {
    for (var i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
    return this;
  };

  /* ── module grid ── */
  function Grid(size) {
    this.size = size;
    this.m = new Uint8Array(size * size);       // 1 = dark
    this.fn = new Uint8Array(size * size);      // 1 = function module (not data)
  }
  Grid.prototype.set = function (x, y, dark, isFn) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    this.m[y * this.size + x] = dark ? 1 : 0;
    if (isFn) this.fn[y * this.size + x] = 1;
  };
  Grid.prototype.get = function (x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return 0;
    return this.m[y * this.size + x];
  };
  Grid.prototype.isFn = function (x, y) { return this.fn[y * this.size + x] === 1; };

  function drawFinder(g, cx, cy) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        var x = cx + dx, y = cy + dy;
        if (x >= 0 && y >= 0 && x < g.size && y < g.size) g.set(x, y, d !== 2 && d !== 4, true);
      }
    }
  }

  function drawAlignment(g, cx, cy) {
    for (var dy = -2; dy <= 2; dy++) {
      for (var dx = -2; dx <= 2; dx++) {
        g.set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
      }
    }
  }

  /** Reserve format/version areas and draw the fixed patterns. */
  function drawFunctionPatterns(g, ver) {
    var size = g.size, i;
    // timing patterns
    for (i = 0; i < size; i++) {
      g.set(6, i, i % 2 === 0, true);
      g.set(i, 6, i % 2 === 0, true);
    }
    drawFinder(g, 3, 3);
    drawFinder(g, size - 4, 3);
    drawFinder(g, 3, size - 4);
    var pos = alignmentPositions(ver);
    for (i = 0; i < pos.length; i++) {
      for (var j = 0; j < pos.length; j++) {
        var corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1)
          || (i === pos.length - 1 && j === 0);
        if (!corner) drawAlignment(g, pos[i], pos[j]);
      }
    }
    // reserve format info (drawn for real later) + dark module
    drawFormatBits(g, 0, 0, true);
    if (ver >= 7) drawVersionBits(g, ver);
  }

  function drawFormatBits(g, eccIdx, mask, reserveOnly) {
    var size = g.size;
    var data = (ECC_FORMAT_BITS[eccIdx] << 3) | mask;
    var rem = data;
    for (var k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    var i;
    for (i = 0; i <= 5; i++) g.set(8, i, reserveOnly ? 0 : (bits >>> i) & 1, true);
    g.set(8, 7, reserveOnly ? 0 : (bits >>> 6) & 1, true);
    g.set(8, 8, reserveOnly ? 0 : (bits >>> 7) & 1, true);
    g.set(7, 8, reserveOnly ? 0 : (bits >>> 8) & 1, true);
    for (i = 9; i < 15; i++) g.set(14 - i, 8, reserveOnly ? 0 : (bits >>> i) & 1, true);
    for (i = 0; i < 8; i++) g.set(size - 1 - i, 8, reserveOnly ? 0 : (bits >>> i) & 1, true);
    for (i = 8; i < 15; i++) g.set(8, size - 15 + i, reserveOnly ? 0 : (bits >>> i) & 1, true);
    g.set(8, size - 8, 1, true); // always-dark module
  }

  function drawVersionBits(g, ver) {
    var rem = ver;
    for (var k = 0; k < 12; k++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (ver << 12) | rem;
    for (var i = 0; i < 18; i++) {
      var bit = (bits >>> i) & 1;
      var a = g.size - 11 + (i % 3);
      var b = Math.floor(i / 3);
      g.set(a, b, bit, true);
      g.set(b, a, bit, true);
    }
  }

  /** Interleave data + ECC blocks per spec 8.6, returning all codewords. */
  function addEcc(dataCw, ver, eccIdx) {
    var numBlocks = ECC_BLOCKS[eccIdx][ver];
    var eccLen = ECC_PER_BLOCK[eccIdx][ver];
    var rawCw = Math.floor(rawDataModules(ver) / 8);
    var numShort = numBlocks - (rawCw % numBlocks);
    var shortLen = Math.floor(rawCw / numBlocks) - eccLen;

    var divisor = rsDivisor(eccLen);
    var blocks = [];
    var k = 0, i, j;
    for (i = 0; i < numBlocks; i++) {
      var len = shortLen + (i < numShort ? 0 : 1);
      var dat = dataCw.slice(k, k + len);
      k += len;
      blocks.push({ dat: dat, ecc: rsRemainder(dat, divisor) });
    }
    var out = [];
    for (i = 0; i < shortLen + 1; i++) {
      for (j = 0; j < numBlocks; j++) {
        if (i < shortLen || j >= numShort) out.push(blocks[j].dat[i]);
      }
    }
    for (i = 0; i < eccLen; i++) {
      for (j = 0; j < numBlocks; j++) out.push(blocks[j].ecc[i]);
    }
    return out;
  }

  function drawCodewords(g, cw) {
    var size = g.size, i = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) {
        for (var k = 0; k < 2; k++) {
          var x = right - k;
          var upward = ((right + 1) & 2) === 0;
          var y = upward ? size - 1 - vert : vert;
          if (!g.isFn(x, y) && i < cw.length * 8) {
            g.set(x, y, (cw[i >>> 3] >>> (7 - (i & 7))) & 1, false);
            i++;
          }
        }
      }
    }
    return i;
  }

  function applyMask(g, mask) {
    for (var y = 0; y < g.size; y++) {
      for (var x = 0; x < g.size; x++) {
        if (g.isFn(x, y)) continue;
        var invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (invert) g.m[y * g.size + x] ^= 1;
      }
    }
  }

  /**
   * Spec 8.8.3 / Table 11 penalty score — lower is better.
   * N1 = 3 (runs of 5+), N2 = 3 (2x2 blocks), N3 = 40 (1:1:3:1:1 pattern with a
   * 4-module light area on at least one side), N4 = 10 per 5% off a 50/50
   * dark/light split. Cross-checked against segno in tests/unit/tickets-qr.test.mjs.
   */
  function penalty(g) {
    var size = g.size, x, y, i;
    var n1 = 0, n2 = 0, n3 = 0, dark = 0;
    var col = new Uint8Array(size);
    for (y = 0; y < size; y++) {
      var rowPrev = -1, colPrev = -1, runRow = 0, runCol = 0;
      var row = new Uint8Array(size);
      for (x = 0; x < size; x++) {
        var rb = g.get(x, y);
        var cb = g.get(y, x);
        row[x] = rb; col[x] = cb;
        dark += rb;
        if (rb === rowPrev) runRow++; else { if (runRow >= 5) n1 += runRow - 2; runRow = 1; }
        if (cb === colPrev) runCol++; else { if (runCol >= 5) n1 += runCol - 2; runCol = 1; }
        if (y > 0 && x > 0 && rb === rowPrev && rb === g.get(x, y - 1) && rb === g.get(x - 1, y - 1)) n2 += 3;
        rowPrev = rb; colPrev = cb;
      }
      if (runRow >= 5) n1 += runRow - 2;
      if (runCol >= 5) n1 += runCol - 2;
      n3 += finderLike(row, size);
      n3 += finderLike(col, size);
    }
    var total = size * size;
    var n4 = Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
    return n1 + n2 + n3 + n4;
  }

  var N3 = [1, 0, 1, 1, 1, 0, 1];
  /** Count 1:1:3:1:1 occurrences in one line, scoring 40 each. */
  function finderLike(seq, size) {
    var score = 0;
    var idx = indexOfPattern(seq, size, 0);
    while (idx !== -1) {
      var after = idx + 7;
      var quietBefore = allLight(seq, Math.max(idx - 4, 0), idx);
      var quietAfter = allLight(seq, after, Math.min(after + 4, size));
      if (idx === 0 || idx === size - 7 || quietBefore || quietAfter) {
        score += 40;
      } else {
        after = idx + 4; // overlapping matches can share the middle dark run
      }
      idx = indexOfPattern(seq, size, after);
    }
    return score;
  }
  function indexOfPattern(seq, size, from) {
    for (var i = from; i + 7 <= size; i++) {
      var hit = true;
      for (var j = 0; j < 7; j++) { if (seq[i + j] !== N3[j]) { hit = false; break; } }
      if (hit) return i;
    }
    return -1;
  }
  function allLight(seq, a, b) {
    for (var i = a; i < b; i++) if (seq[i]) return false;
    return true;
  }

  /* ── public: encode ── */
  function encode(text, opts) {
    opts = opts || {};
    var eccName = String(opts.ecc || 'M').toUpperCase();
    var eccIdx = ECC_LEVELS[eccName];
    if (eccIdx == null) { eccName = 'M'; eccIdx = 1; }
    var bytes = utf8Bytes(text == null ? '' : text);
    var minV = Math.max(MIN_VERSION, opts.minVersion || MIN_VERSION);
    var maxV = Math.min(MAX_VERSION, opts.maxVersion || MAX_VERSION);

    var ver = -1, capacityBits = 0;
    for (var v = minV; v <= maxV; v++) {
      var cap = dataCodewords(v, eccIdx) * 8;
      var lenBits = v <= 9 ? 8 : 16;                 // byte mode char-count bits
      if (4 + lenBits + bytes.length * 8 <= cap) { ver = v; capacityBits = cap; break; }
    }
    if (ver < 0) {
      throw new Error('ZoiQR: payload too long (' + bytes.length
        + ' bytes) for QR versions ' + minV + '-' + maxV + ' at ECC ' + eccName);
    }

    var bb = new BitBuf();
    bb.push(4, 4);                                    // byte mode
    bb.push(bytes.length, ver <= 9 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) bb.push(bytes[i], 8);
    // terminator + pad to byte boundary + pad codewords
    bb.push(0, Math.min(4, capacityBits - bb.bits.length));
    bb.push(0, (8 - (bb.bits.length % 8)) % 8);
    for (var pad = 0xEC; bb.bits.length < capacityBits; pad ^= 0xEC ^ 0x11) bb.push(pad, 8);

    var dataCw = [];
    for (i = 0; i < bb.bits.length; i += 8) {
      var byteVal = 0;
      for (var b = 0; b < 8; b++) byteVal = (byteVal << 1) | bb.bits[i + b];
      dataCw.push(byteVal);
    }
    var allCw = addEcc(dataCw, ver, eccIdx);

    var size = ver * 4 + 17;
    var base = new Grid(size);
    drawFunctionPatterns(base, ver);
    drawCodewords(base, allCw);

    var wantMask = (opts.mask != null && opts.mask >= 0 && opts.mask <= 7) ? opts.mask : -1;
    var best = null, bestScore = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) {
      if (wantMask >= 0 && mask !== wantMask) continue;
      var g = new Grid(size);
      g.m.set(base.m); g.fn.set(base.fn);
      drawFormatBits(g, eccIdx, mask, false);
      applyMask(g, mask);
      var sc = wantMask >= 0 ? 0 : penalty(g);
      if (sc < bestScore) { bestScore = sc; best = g; bestMask = mask; }
    }
    return {
      size: size, version: ver, ecc: eccName, mask: bestMask,
      modules: best.m,
      at: function (x, y) { return best.m[y * size + x] === 1; }
    };
  }

  /* ── public: SVG ── */
  function svg(text, opts) {
    opts = opts || {};
    var q = opts.quiet == null ? 4 : opts.quiet;
    var scale = opts.scale || 4;
    var code = encode(text, opts);
    var dim = (code.size + q * 2) * scale;
    var path = [];
    for (var y = 0; y < code.size; y++) {
      for (var x = 0; x < code.size; x++) {
        if (code.modules[y * code.size + x]) {
          path.push('M' + ((x + q) * scale) + ' ' + ((y + q) * scale) + 'h' + scale + 'v' + scale + 'h-' + scale + 'z');
        }
      }
    }
    var title = opts.title ? '<title>' + String(opts.title).replace(/[&<>]/g, '') + '</title>' : '';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + dim + '" height="' + dim
      + '" viewBox="0 0 ' + dim + ' ' + dim + '" role="img" shape-rendering="crispEdges">'
      + title
      + '<rect width="' + dim + '" height="' + dim + '" fill="' + (opts.light || '#ffffff') + '"/>'
      + '<path d="' + path.join('') + '" fill="' + (opts.dark || '#000000') + '"/></svg>';
  }

  /* ── public: canvas ── */
  function toCanvas(canvas, text, opts) {
    opts = opts || {};
    var q = opts.quiet == null ? 4 : opts.quiet;
    var code = encode(text, opts);
    var scale = opts.scale || Math.max(2, Math.floor((opts.px || 240) / (code.size + q * 2)));
    var dim = (code.size + q * 2) * scale;
    canvas.width = dim; canvas.height = dim;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = opts.light || '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = opts.dark || '#000000';
    for (var y = 0; y < code.size; y++) {
      for (var x = 0; x < code.size; x++) {
        if (code.modules[y * code.size + x]) ctx.fillRect((x + q) * scale, (y + q) * scale, scale, scale);
      }
    }
    return canvas;
  }

  global.ZoiQR = {
    encode: encode,
    svg: svg,
    toCanvas: toCanvas,
    capacityBytes: function (ver, ecc) {
      var idx = ECC_LEVELS[String(ecc || 'M').toUpperCase()];
      return dataCodewords(ver, idx == null ? 1 : idx) - (ver <= 9 ? 2 : 3);
    },
    MAX_VERSION: MAX_VERSION,
    _internals: {
      gfMul: gfMul, rsDivisor: rsDivisor, rsRemainder: rsRemainder,
      rawDataModules: rawDataModules, dataCodewords: dataCodewords,
      alignmentPositions: alignmentPositions, utf8Bytes: utf8Bytes, penalty: penalty
    }
  };
}(typeof window !== 'undefined' ? window : globalThis));
