# Independent artist source media acceptance — 2026-10-01

Reviewer: artist_qa, separate from implementation/release owner. Reviewed candidate bytes match staged tree `31a094ba9738a511e1cbbc557da4f29eeb521405` in `/tmp/zoi-workspace-artist-release-f6mv3ko0` for `api/_music-home.js` and music `app.mjs`, `render.mjs`, `model.mjs`.

## Source/projection evidence

32 focused tests passed across music-generic-source, music-home, music-canonical-home, music-source-attribution, music-reviewed-media and media-extraction. Tests exercise actual extractor output through the generic home projection, exact source path mismatch, quarantine, organization identity, authorized replacement and explicit owner clears. Provider parsing rejects credentials, unexpected hosts/ports and invalid IDs. Single video and playlist are distinct; playlist retains priority. Channel-only YouTube remains an external link. No recordings or shows are invented from a provider URL.

This is fixture evidence of source preservation, not a claim that a particular current artist's provider account is connected.

## Rendered/exercised journey

`node tests/browser/artist-source-video/verify.mjs` passed all eight combinations of 390/1440 widths and Atelier/Concierge/Table/Parea designs using the actual server renderer, JS module chain and stylesheet. ZoiCore is a controlled anonymous adapter; all external provider/image requests are blocked.

Each combination exercised click → modal open → correct artist title, exact privacy-enhanced YouTube iframe URL and external fallback → close button → iframe removed and trigger focus restored → reopen → Escape → iframe removed, dialog closed and trigger focus restored. No document overflow or JavaScript page errors. Before user action, rendering tests confirm no embedded iframe.

Visually inspected `/tmp/artist-source-video-concierge-390.png` and `/tmp/artist-source-video-atelier-1440.png`; headings, close control and fallback are visible and contained. The empty frame is a deliberately blocked provider, not playback acceptance. All eight screenshots are `/tmp/artist-source-video-{template}-{width}.png`.

## Real production candidate / limits

Read-only production query of published, clean artists with `_enrich.listen` returned two: curated Giorgos Dalaras and generic Ano Kato. Ano Kato (`93a0f1e8-2c8b-4306-8b5d-579577465240`, `/artist/ano-kato-vries`) has matched source `https://anokato.nl/` and `https://www.youtube.com/user/anokatomichali`. Production predeployment hydration captured in `/tmp/ano-kato-before-source-video.html` already carries this channel through social links. Postdeployment expectation is preservation of the external channel and absence of a fabricated singlevideo player.

No real generic singlevideo record was found by this query. Real YouTube playback, provider availability, authentication, owner publishing, physical iOS/Android, and catalogue-wide enrichment are not proved here. Ano Kato's imported `_derived/*bnr.gif` portrait/gallery is a separate observed enrichment quality gap and has been reported to integration; this media patch does not fix it.

## Final import-graph correction

The initial tree above was superseded after release tracing rejected a server-side query-string import. Integration moved the three YouTube helpers to `artist-video.mjs`; app/render import it directly and the base model reexports for compatibility. Independently reran all eight mounted combinations successfully against this final graph. Also repeated all eight with `CACHED_MODEL_PATH=/tmp/artist-source-video-old-model.mjs`, serving the prior committed model in place of the current base model: all sixteen combined scenarios passed with the same modal/focus/unload assertions. This explicitly covers a visitor retaining the old base model after the new versioned app/render arrives. The previous tree identity is historical evidence, not the final release hash.
