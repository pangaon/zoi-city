// assets/tickets/qr.js is a from-scratch QR encoder. "It drew some squares" is
// not evidence a phone will scan it, and a door volunteer finding out at the
// door is the worst possible time. So this file checks it two ways.
//
// 1. FIXTURES from segno, an independent, widely-used reference encoder
//    (generated once with `segno.make(text, error=..., mode='byte',
//    boost_error=False)` and pasted in). We assert our chosen version matches,
//    that segno's own matrices decode through our reader, and that our penalty
//    scoring reproduces segno's `evaluate_mask` score exactly on those
//    matrices — which pins rules N1-N4 of ISO/IEC 18004 Table 11.
//
//    We deliberately do NOT require byte-identical matrices: segno appends a
//    spurious 0x00 codeword when the bit stream is already byte-aligned after
//    the terminator (encoder.py write_padding_bits: `8 - (length % 8)` is 8,
//    not 0, when aligned). Both symbols are valid and decode identically; ours
//    follows the spec's EC/11 padding. That different pad byte changes the
//    penalty scores, so the auto-chosen mask can differ.
//
// 2. ROUND TRIP through tests/unit/qr-read.mjs for every version 1-10 at all
//    four ECC levels, asserting the text comes back and every Reed-Solomon
//    block's syndromes are zero.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeReader } from './qr-read.mjs';

const g = {};
new Function('window', 'globalThis',
  readFileSync(new URL('../../assets/tickets/qr.js', import.meta.url), 'utf8'))(g, g);
const QR = g.ZoiQR;
const read = makeReader(QR);

/** Reference symbols from segno 1.6.6. */
const FIXTURES = [
  {
    text: "ZK7-4QX",
    ecc: 'M', version: 1, mask: 0, penalty: 1011,
    matrix: [
      '111111100101101111111',
      '100000101001101000001',
      '101110100100101011101',
      '101110100011101011101',
      '101110101011101011101',
      '100000100111001000001',
      '111111101010101111111',
      '000000000010000000000',
      '101010100010100010010',
      '011010011011010101110',
      '100001100001001011011',
      '100010011011110101011',
      '101010101111001001000',
      '000000001110001000000',
      '111111100100100111011',
      '100000100100001001001',
      '101110101000101010011',
      '101110100001010000110',
      '101110101101011111101',
      '100000100001110101010',
      '111111101001011111011',
    ],
  },
  {
    text: "A",
    ecc: 'L', version: 1, mask: 7, penalty: 982,
    matrix: [
      '111111100010101111111',
      '100000101010101000001',
      '101110101011001011101',
      '101110100000101011101',
      '101110101111101011101',
      '100000101110001000001',
      '111111101010101111111',
      '000000001000000000000',
      '110100110011101110110',
      '110101000001010101010',
      '100010110111001110111',
      '001001011110111110001',
      '101010100101011100101',
      '000000001110011010100',
      '111111101011101011010',
      '100000100000001000100',
      '101110100110111000111',
      '101110101010011100011',
      '101110100101011101101',
      '100000101011100101000',
      '111111101010010100110',
    ],
  },
  {
    text: "HELLO WORLD",
    ecc: 'H', version: 2, mask: 7, penalty: 1140,
    matrix: [
      '1111111011010000101111111',
      '1000001011100101101000001',
      '1011101000000111001011101',
      '1011101010110101001011101',
      '1011101010101101101011101',
      '1000001011000100101000001',
      '1111111010101010101111111',
      '0000000001001011000000000',
      '0001001000010011000111011',
      '0000010000000100010000110',
      '1011011101101010010100011',
      '0111010100111001100110010',
      '0111011001001101011110111',
      '0001110001011111110100010',
      '1001111010011010001110101',
      '0111010011010001010010010',
      '1110101010011110111110000',
      '0000000010011101100010100',
      '1111111000100010101011011',
      '1000001001101100100011101',
      '1011101001000011111110010',
      '1011101011011101110101010',
      '1011101001010111101010001',
      '1000001000011111000000000',
      '1111111000111010101111111',
    ],
  },
  {
    text: "Ελληνικά — Πανηγύρι 2026",
    ecc: 'Q', version: 4, mask: 6, penalty: 1379,
    matrix: [
      '111111100001110001110000101111111',
      '100000101011100110101001101000001',
      '101110100100001000010101001011101',
      '101110101001011100101111001011101',
      '101110101001000000000000101011101',
      '100000100101011000010110101000001',
      '111111101010101010101010101111111',
      '000000001011010011100101000000000',
      '010111101001010111100101111011010',
      '101101011101101111111010010001101',
      '000011100011101100001100001110110',
      '010100011000101110101011111100010',
      '010010100001001111011010100001111',
      '000000001011010110111110011011001',
      '110101111100111111110001000100011',
      '100010001110000111001110110100000',
      '010000100101111010100001010100010',
      '111100000101011001100010100100011',
      '000111111111101000001010100001010',
      '100011011011101100011001000010010',
      '100110100111110000010011111111001',
      '111001000110101111001100101101001',
      '101111100100111001001110010010110',
      '100100010111000001111010001110001',
      '110001100011011010011010111111110',
      '000000001100011011011000100010011',
      '111111100001001101000110101011001',
      '100000101101100101111011100011001',
      '101110101001010111000000111111101',
      '101110101010111110110000101100001',
      '101110100010000101011110000101011',
      '100000101000101010001100100010011',
      '111111100111010000010001000001000',
    ],
  },
  {
    text: "https://www.zoi.city/tickets?e=8f3c1a2b-4d5e-6f70-8912-abcdef012345&c=ZK7-4QX",
    ecc: 'M', version: 5, mask: 2, penalty: 1495,
    matrix: [
      '1111111001111110000010011100101111111',
      '1000001000000011111010000111101000001',
      '1011101010110100000001100000001011101',
      '1011101011110001010010101111001011101',
      '1011101010101001011101010000001011101',
      '1000001011111101101000100011101000001',
      '1111111010101010101010101010101111111',
      '0000000011111100101111011001000000000',
      '1011111001001101101010100110001111100',
      '1011100100001101001011011000110000110',
      '0100111111111001111001101101011000011',
      '1001000111001001000011100010010011001',
      '1001101101111111011000101111011110111',
      '0110110011010100100111110000110100000',
      '1001111010110011001000000011100111001',
      '1100010101110001101001101010111110011',
      '0010011001010001001110010110001110111',
      '1111100001001111101101111100110000010',
      '1001001101011110001011100001111101111',
      '1001100110010010100011011011010110001',
      '1010101010110010110110101111011011100',
      '1111010110101000011100110010110001000',
      '1100111011011001110011101111001111011',
      '0011000010000101111011100000011110011',
      '0001001110111000100101100100001010111',
      '1110010110110001001101111010110000000',
      '1010101111011011101010001011111001111',
      '1001110000110001000111111001110001011',
      '1000001011111111011010000110111110110',
      '0000000011101010000100110010100011010',
      '1111111001111001001010000000101010101',
      '1000001010000110000011010000100011001',
      '1011101011010101001011110101111110111',
      '1011101011000101100100011111101010001',
      '1011101011101000011010100000100000111',
      '1000001001011010101101101011101011001',
      '1111111011100110010100101101000010111',
    ],
  },
  {
    text: "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy",
    ecc: 'M', version: 10, mask: 1, penalty: 2432,
    matrix: [
      '111111101001101100111000101010101010101010101111001111111',
      '100000100000111110000011011011101110111011101101001000001',
      '101110101111100000001011010001011100010001000111001011101',
      '101110100110001100101101110101011101010101010101001011101',
      '101110100100101100100000111111110010101010101001001011101',
      '100000101001000110000111011000111110111011101110001000001',
      '111111101010101010101010101010101010101010101010101111111',
      '000000000001010111010010111000111011101110111010100000000',
      '101000110001110000110000001111101010101010101010000100101',
      '110010000010010100011001001101010101010101010101010100111',
      '000111100111100001111110101100010001000100010000100100101',
      '000001000001101001010100110000111011101110111010101111010',
      '010000101001101110110110100000101010101010101010001010010',
      '111001000010000100011100000011010101010101010101010100111',
      '001111100111100011111110101000010001000100010000100100101',
      '000000000111100011010010000110111011101110111010101111000',
      '011100101001101000110010001010101010101010101010001010010',
      '110101000010000010000001001101010101010101010101010100111',
      '000000100011100011111100101100010001000100010000100100101',
      '001011010101100011110010110110011011101110111010101111010',
      '011111100101101000110110000010101010101010101010001010010',
      '110101011010100010111011001100010101010101010101010100111',
      '010000110101000011000100101100110001000100010000100100101',
      '111011011110000011100010110110100011101110111010101111010',
      '011111110101001000101110000010111010101010101010001010010',
      '000101000011100010110011001101000101010101010101010100111',
      '110011111100111010000100111111111001000100010000111110101',
      '101010001110010011110010111000111011101110111010100011010',
      '000010101100011011001110011010101010101010101011101010010',
      '111110001010010000010011011000110101010101010101100010111',
      '111111111101101000000110101111110001000100010000111110101',
      '100111000111010111110110111011111011101110111011111011010',
      '111000100100000111001111111001001010101010101011010000010',
      '011000010010011000010111101101010101010101010100010100100',
      '110110101011111000000011000010110001000100010000001010100',
      '101111001111000001110011111011111011101110111011111011000',
      '110000100010000011011110000011001010101010101011010000011',
      '010011010100000100001001010001010101010101010100010100111',
      '110000101011111001110010110010110001000100010000001010101',
      '100011001011000010011100110001111011101110111011111011010',
      '110011100111100010110010011001001010101010101011010000010',
      '010011010000000100011011001101010101010101010100010100111',
      '010011101000011001101010100010110001000100010000001010101',
      '010000001111000011101100111011100011101110111011111011010',
      '100011110101000011011010011000011010101010101011010000010',
      '010011010100100101001011001100110101010101010100010100111',
      '101001101001000000001010100010010001000100010000001010101',
      '111110010111110011100100111010011011101110111011111011010',
      '000000111101000001111010011111101010101010101011111110010',
      '000000001100110001001011001000110101010101010101100010111',
      '111111101001100110001100101010110001000100010001101010101',
      '100000100110100011100110101000111011101110111010100011010',
      '101110100101011011111100101111101010101010101010111110010',
      '101110100100111111001000011110110101010101010101101110100',
      '101110101111110100001100110010110001000100010000101010111',
      '100000100110100111100000010101011011101110111011010101000',
      '111111101001010011111000001100001010101010101011000100001',
    ],
  },
];

const at = (matrix) => (x, y) => (matrix[y][x] === '1' ? 1 : 0);
const mineAt = (r) => (x, y) => r.modules[y * r.size + x];

test('segno reference symbols decode through our reader (so the reader is trustworthy)', () => {
  for (const f of FIXTURES) {
    const d = read(at(f.matrix), f.matrix.length);
    assert.equal(d.text, f.text, 'text for ' + JSON.stringify(f.text.slice(0, 24)));
    assert.equal(d.version, f.version);
    assert.equal(d.ecc, f.ecc);
    assert.equal(d.mask, f.mask);
    assert.equal(d.formatErrors, 0, 'format info should be exact');
    assert.ok(d.intact, 'Reed-Solomon syndromes must be zero');
  }
});

test('we pick the same symbol version as segno for the same payload and ECC level', () => {
  for (const f of FIXTURES) {
    const r = QR.encode(f.text, { ecc: f.ecc });
    assert.equal(r.version, f.version, JSON.stringify(f.text.slice(0, 24)) + ' at ECC ' + f.ecc);
    assert.equal(r.size, f.matrix.length);
    assert.equal(r.ecc, f.ecc);
  }
});

test('our mask penalty reproduces segno evaluate_mask exactly (ISO 18004 Table 11)', () => {
  for (const f of FIXTURES) {
    const size = f.matrix.length;
    const m = new Uint8Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) m[y * size + x] = f.matrix[y][x] === '1' ? 1 : 0;
    const grid = {
      size,
      m,
      get(x, y) { return (x < 0 || y < 0 || x >= size || y >= size) ? 0 : m[y * size + x]; },
    };
    assert.equal(QR._internals.penalty(grid), f.penalty,
      'penalty for the v' + f.version + ' ' + f.ecc + ' reference symbol');
  }
});

test('our own symbols decode back to the payload, with intact error correction', () => {
  for (const f of FIXTURES) {
    const r = QR.encode(f.text, { ecc: f.ecc });
    const d = read(mineAt(r), r.size);
    assert.equal(d.text, f.text);
    assert.equal(d.version, r.version);
    assert.equal(d.ecc, f.ecc);
    assert.equal(d.mask, r.mask, 'the format info must advertise the mask we actually applied');
    assert.equal(d.formatErrors, 0);
    assert.ok(d.intact, 'Reed-Solomon syndromes must be zero');
  }
});

test('every payload length in versions 1-10 round-trips at all four ECC levels', () => {
  let checked = 0;
  for (const ecc of ['L', 'M', 'Q', 'H']) {
    const max = QR.capacityBytes(10, ecc);
    assert.ok(max > 100, 'v10 ' + ecc + ' should hold a sensible amount');
    for (let len = 1; len <= max; len++) {
      // printable ASCII, cycling, so each length is a genuinely different payload
      let text = '';
      for (let i = 0; i < len; i++) text += String.fromCharCode(33 + ((i * 7) % 94));
      const r = QR.encode(text, { ecc });
      const d = read(mineAt(r), r.size);
      assert.equal(d.text, text, ecc + ' len ' + len);
      assert.ok(d.intact, ecc + ' len ' + len + ' has corrupt ECC blocks');
      assert.equal(d.ecc, ecc);
      assert.equal(d.mask, r.mask);
      checked++;
    }
  }
  assert.ok(checked > 700, 'expected to sweep the whole capacity range, got ' + checked);
});

test('a forced mask is honoured and still decodes', () => {
  for (let mask = 0; mask < 8; mask++) {
    const r = QR.encode('ZK7-4QX', { ecc: 'M', mask });
    assert.equal(r.mask, mask);
    const d = read(mineAt(r), r.size);
    assert.equal(d.mask, mask);
    assert.equal(d.text, 'ZK7-4QX');
    assert.ok(d.intact);
  }
});

test('non-ASCII payloads are encoded as UTF-8, not mangled', () => {
  const greek = 'Παναγία · Πανηγύρι 2026 — ΖΩΗ';
  const r = QR.encode(greek, { ecc: 'M' });
  assert.equal(read(mineAt(r), r.size).text, greek);
  assert.equal(QR._internals.utf8Bytes('Ω').length, 2);
  assert.equal(QR._internals.utf8Bytes('😀').length, 4, 'astral plane characters must not be split');
  const emoji = 'gate 😀 open';
  assert.equal(read(mineAt(QR.encode(emoji)), QR.encode(emoji).size).text, emoji);
});

test('an over-long payload throws instead of silently truncating', () => {
  const tooLong = 'x'.repeat(QR.capacityBytes(10, 'M') + 1);
  assert.throws(() => QR.encode(tooLong, { ecc: 'M' }), /too long/i);
  // and the boundary case fits
  const exact = 'x'.repeat(QR.capacityBytes(10, 'M'));
  const r = QR.encode(exact, { ecc: 'M' });
  assert.equal(r.version, 10);
  assert.equal(read(mineAt(r), r.size).text, exact);
});

test('the fixed patterns are where the spec says, so a scanner can find the symbol', () => {
  const r = QR.encode('https://www.zoi.city/tickets?e=1&c=ABC123', { ecc: 'M' });
  const dark = (x, y) => r.modules[y * r.size + x] === 1;
  // three finder patterns: dark 7x7 ring with a dark 3x3 core
  for (const [cx, cy] of [[3, 3], [r.size - 4, 3], [3, r.size - 4]]) {
    assert.ok(dark(cx, cy), 'finder core');
    assert.ok(dark(cx - 3, cy - 3) && dark(cx + 3, cy + 3), 'finder outer ring');
    assert.ok(!dark(cx - 2, cy - 2) && !dark(cx + 2, cy + 2), 'finder light ring');
  }
  // separators are light
  assert.ok(!dark(7, 7));
  // timing patterns alternate
  for (let i = 8; i < r.size - 8; i++) {
    assert.equal(dark(6, i), i % 2 === 0, 'vertical timing at ' + i);
    assert.equal(dark(i, 6), i % 2 === 0, 'horizontal timing at ' + i);
  }
  // the always-dark module
  assert.ok(dark(8, r.size - 8));
});

test('alignment pattern positions match the spec table for versions 1-10', () => {
  const expected = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };
  for (const [ver, pos] of Object.entries(expected)) {
    assert.deepEqual(QR._internals.alignmentPositions(+ver), pos, 'version ' + ver);
  }
});

test('total codeword counts match the spec table for versions 1-10', () => {
  const total = [null, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  for (let v = 1; v <= 10; v++) {
    assert.equal(Math.floor(QR._internals.rawDataModules(v) / 8), total[v], 'version ' + v);
  }
});

test('svg output is well-formed, sized right, and paints the same modules', () => {
  const code = QR.encode('ZK7-4QX', { ecc: 'M' });
  const svg = QR.svg('ZK7-4QX', { ecc: 'M', scale: 4, quiet: 4, title: 'Ticket' });
  const dim = (code.size + 8) * 4;
  assert.match(svg, new RegExp('width="' + dim + '" height="' + dim + '"'));
  assert.match(svg, /<title>Ticket<\/title>/);
  assert.match(svg, /shape-rendering="crispEdges"/);
  // one path segment per dark module
  const segments = (svg.match(/M\d+ \d+h/g) || []).length;
  const darkCount = code.modules.reduce((a, b) => a + b, 0);
  assert.equal(segments, darkCount);
  // a title cannot inject markup
  assert.ok(!QR.svg('x', { title: '</title><script>bad()</script>' }).includes('<script>'));
});
