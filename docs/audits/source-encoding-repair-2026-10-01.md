# Source encoding repair — candidate

The current public MOREAS record contains replacement characters in imported French text. A fresh fetch of its official stored website, http://www.musique-grecque.com/, returned `text/html` without an HTTP charset; the first HTML meta declaration specifies ISO-8859-1. The 2,284 source bytes have SHA-256 `f641b72572a7b9b304ec1f54c7d2df4407e0cd2bd8043673100dba9b552a21b6`.

The worker currently checks only the transport charset and otherwise decodes UTF-8. This creates 31 replacement characters on these bytes. The candidate honors the bounded initial HTML declaration, producing zero replacement characters and the title `Groupe de Musique Grecque MORÉAS`.

The shared worker change gives BOM and supported transport declarations priority, inspects only the first 1,024 bytes of HTML, skips comments and raw script/style blocks, handles quoted attributes, and keeps the existing UTF-8 fallback without language guessing. It is a bounded extraction helper, not a complete browser parser. Reference: https://html.spec.whatwg.org/multipage/parsing.html#determining-the-character-encoding

Four test groups cover legacy source text, BOM/transport precedence, false declarations in comments/script/attributes, unsupported labels, missing legacy pragma, non-HTML and prescan bounds. Independent review pending. This candidate has not been deployed and does not retroactively repair published records. Existing description extraction also truncates this source at its embedded apostrophe; that separate extraction issue remains open.

The fresh inventory contains 30,672 publicly eligible records. Aggregate metadata is recorded separately in `listing-inventory-refresh-2026-10-01.json`; it does not establish per-profile source/render/journey acceptance. Earlier three-record canary proposals are stale: all three now have attempt records, including one blocked source, so the old missing-attempt canary must not be rerun blindly.
