# Source decoder independent review — 2026-10-01

Reviewer: room_repair. Runtime owner: root. This review concerns future enrichment fetch decoding, not retroactive correction of published content.

## Actual source

`/tmp/moreas-source-body`: 2284 bytes, SHA-256 `f641b72572a7b9b304ec1f54c7d2df4407e0cd2bd8043673100dba9b552a21b6`. Header text/html omits charset; first HTML declaration supplies iso-8859-1. Existing UTF-8 decoding produced31 replacement characters; candidate produced0. This is decoding evidence, not proof that every extracted field or published profile is correct.

## Independent findings sent to implementer

1. Initial transport regex recognized `charset` inside a quoted unrelated MIME parameter. Updated quoted tokenizer fixes the ordinary quoted case, but escaped quote variant still corrupted Greek UTF-8. A proper quoted-string scanner must consume backslash escapes.
2. HTML prescan skipped script/style but not title/textarea. Fake meta declaration inside these text elements incorrectly overrode a later real UTF-8 declaration. Chromium comparison confirmed UTF-8 for both; candidate originally chose windows-1252.
3. `<meta/charset=windows-1252>` is accepted by Chromium but the candidate's meta whitespace-only condition ignored it.

Browser comparison script retained at `/tmp/zoi-decoder-browser-check.cjs`. UTF-16LE and UTF-16BE BOM override checks passed. Initial four committed test groups passed, showing why adversarial independent cases were necessary.

## References and limits

Reviewed against [HTML encoding determination](https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding) and [MIME parameter parsing](https://mimesniff.spec.whatwg.org/#parse-a-mime-type). The bounded1024-byte scan deliberately keeps UTF-8 as undeclared fallback and does not guess source language. No full HTML parser compliance claim is made. Undeclared legacy text and declarations outside the bounded scan remain limited. Current worker integration preserves fetch limits/redirect handling; decoder-only repair does not re-enrich existing records by itself.

## Frozen candidate acceptance

Accepted for the bounded future HTML decoding repair after all reported issues were corrected. Six committed test groups pass. Independent escaped-note, title/textarea/script/style, slash-meta, UTF-16LE/BE BOM, quoted charset escape, and actual Moreas source probes pass. The implementation owner made runtime changes; reviewer made no runtime edits.

- `_decode.js` SHA-256: `101c91d0945982bced6b80782f85485e5b3652929116731db86dd52635eb654e`
- `enrichment-source-decoding.test.mjs` SHA-256: `0a1a701f67b7be4bdb1452370cb433e4c99e7214924b2504bcc83e7646bd1c26`

Integration inspected at `zoi-enrich/index.ts`: accumulated source byte buffer is passed to decodeSource with response Content-Type. Existing network/size bounds remain. No worker deployed by reviewer, no published data rewritten, and no full HTML parser or universal encoding-detection claim.
