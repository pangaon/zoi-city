// A QR *reader*, written for the tests only.
//
// assets/tickets/qr.js is a from-scratch QR encoder, and "it renders squares"
// is not evidence that a phone can scan it. So the tests read the symbol back:
// locate the function patterns, recover the format information, undo the mask,
// de-interleave the Reed-Solomon blocks, check every block's syndromes are
// zero, and parse the byte-mode segment back to text.
//
// It is pointed at two things: matrices produced by segno (an independent,
// widely-used reference encoder, baked in as fixtures) and matrices produced by
// our encoder. If the reader can decode segno's output, the reader and the
// version/ECC tables it shares with the encoder are trustworthy; if it can then
// decode ours, ours is a real QR code.

/* ECC tables live in the encoder; the reader borrows them. That is safe
 * because the reader is also run against segno's fixtures — a wrong table
 * fails there first. */
export function makeReader(ZoiQR) {
  const ECC_PER_BLOCK = [
    [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
    [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
    [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
    [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
  ];
  const ECC_BLOCKS = [
    [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
    [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
    [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
    [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
  ];
  const LEVEL_NAME = ['L', 'M', 'Q', 'H'];
  // format-info ECC indicator bits -> level index
  const BITS_TO_LEVEL = { 1: 0, 0: 1, 3: 2, 2: 3 };
  const { gfMul, rawDataModules, alignmentPositions } = ZoiQR._internals;

  /** All 32 valid 15-bit format strings, for nearest-match recovery. */
  const FORMAT_TABLE = [];
  for (let d = 0; d < 32; d++) {
    let rem = d;
    for (let k = 0; k < 10; k++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    FORMAT_TABLE.push({ data: d, bits: ((d << 10) | rem) ^ 0x5412 });
  }
  const popcount = (n) => { let c = 0; while (n) { c += n & 1; n >>>= 1; } return c; };

  function functionMap(size, version) {
    const fn = new Uint8Array(size * size);
    const mark = (x, y) => {
      if (x >= 0 && y >= 0 && x < size && y < size) fn[y * size + x] = 1;
    };
    for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy);
    }
    const pos = alignmentPositions(version);
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const corner = (i === 0 && j === 0) || (i === 0 && j === pos.length - 1)
          || (i === pos.length - 1 && j === 0);
        if (corner) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(pos[i] + dx, pos[j] + dy);
      }
    }
    for (let i = 0; i <= 8; i++) { mark(8, i); mark(i, 8); }
    for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
    if (version >= 7) {
      for (let i = 0; i < 18; i++) {
        const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
        mark(a, b); mark(b, a);
      }
    }
    return fn;
  }

  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
      case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
      default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    }
  }

  /** Reed-Solomon syndromes: all zero iff the block is intact. */
  function syndromesZero(block, eccLen) {
    let root = 1;
    for (let s = 0; s < eccLen; s++) {
      root = s === 0 ? 1 : gfMul(root, 0x02);
      let acc = 0;
      for (let i = 0; i < block.length; i++) acc = gfMul(acc, root) ^ block[i];
      if (acc !== 0) return false;
    }
    return true;
  }

  /**
   * @param {(x:number,y:number)=>0|1} at  dark-module accessor
   * @param {number} size
   */
  return function read(at, size) {
    if ((size - 17) % 4 !== 0) throw new Error('bad matrix size ' + size);
    const version = (size - 17) / 4;

    // ---- format information (two copies, nearest valid codeword wins) ----
    let raw = 0;
    for (let i = 0; i <= 5; i++) raw |= at(8, i) << i;
    raw |= at(8, 7) << 6; raw |= at(8, 8) << 7; raw |= at(7, 8) << 8;
    for (let i = 9; i < 15; i++) raw |= at(14 - i, 8) << i;
    let best = null; let bestDist = 99;
    for (const f of FORMAT_TABLE) {
      const d = popcount(raw ^ f.bits);
      if (d < bestDist) { bestDist = d; best = f; }
    }
    if (bestDist > 3) throw new Error('unrecoverable format information');
    const levelIdx = BITS_TO_LEVEL[(best.data >> 3) & 3];
    const mask = best.data & 7;

    // ---- read data region ----
    const fn = functionMap(size, version);
    const bits = [];
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let k = 0; k < 2; k++) {
          const x = right - k;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (fn[y * size + x]) continue;
          bits.push(at(x, y) ^ (maskBit(mask, x, y) ? 1 : 0));
        }
      }
    }
    const totalCw = Math.floor(rawDataModules(version) / 8);
    const cw = [];
    for (let i = 0; i + 8 <= bits.length && cw.length < totalCw; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }

    // ---- de-interleave into blocks ----
    const eccLen = ECC_PER_BLOCK[levelIdx][version];
    const numBlocks = ECC_BLOCKS[levelIdx][version];
    const numShort = numBlocks - (totalCw % numBlocks);
    const shortLen = Math.floor(totalCw / numBlocks) - eccLen;
    const blocks = [];
    for (let b = 0; b < numBlocks; b++) blocks.push([]);
    let p = 0;
    for (let i = 0; i < shortLen + 1; i++) {
      for (let b = 0; b < numBlocks; b++) {
        if (i < shortLen || b >= numShort) blocks[b].push(cw[p++]);
      }
    }
    for (let i = 0; i < eccLen; i++) {
      for (let b = 0; b < numBlocks; b++) blocks[b].push(cw[p++]);
    }
    const intact = blocks.every((b) => syndromesZero(b, eccLen));

    // ---- data bit stream ----
    const data = [];
    for (let b = 0; b < numBlocks; b++) {
      const dataLen = blocks[b].length - eccLen;
      for (let i = 0; i < dataLen; i++) data.push(blocks[b][i]);
    }
    const dbits = [];
    for (const byte of data) for (let i = 7; i >= 0; i--) dbits.push((byte >> i) & 1);
    let cursor = 0;
    const take = (n) => { let v = 0; for (let i = 0; i < n; i++) v = (v << 1) | dbits[cursor++]; return v; };
    const out = [];
    let mode;
    while (cursor + 4 <= dbits.length && (mode = take(4)) !== 0) {
      if (mode !== 4) throw new Error('reader only handles byte mode, saw ' + mode);
      const count = take(version <= 9 ? 8 : 16);
      for (let i = 0; i < count; i++) out.push(take(8));
    }
    return {
      version,
      ecc: LEVEL_NAME[levelIdx],
      mask,
      intact,
      formatErrors: bestDist,
      text: new TextDecoder().decode(new Uint8Array(out)),
    };
  };
}
