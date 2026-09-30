# Paradosi source enrichment — proposed, not applied

This follow-up addresses the North York record after its separately applied website repair. It does not merge either published duplicate, create enrolment, or change owner fields.

Target: `479cc348-4918-4e4e-a7d3-94a1be40b9e5`; exact website `https://www.paradosihdc.com/`.
Read-only preconditions observed 2026-09-30:

- Base hash: `4df82da8ca4994be63fe0cb8aa81f6e4`
- Owner hash: `88665ba605fe8f19e2e2b35770a8b02d`
- Source fingerprint: `a144e449dc46cb8839f3ca66a3927f93`
- No owner workspace; empty public owner content; no current machine enrichment.

## Exact proposed public machine fields

```json
{
  "crawl_status": "ok",
  "description": "Paradosi Hellenic Dance Company teaches and performs Greek folk dances from regions across Greece. Its programmes include Paradosakia for children aged 4–11, the Youth Company for ages 12–17, and Paradosi for adults aged 18 and over.",
  "email": "paradosihdc@gmail.com",
  "address": "120 Banbury Rd, North York, Ontario",
  "mission": "Teaching and performing Greek folk dances from regions across Greece.",
  "membership": "Programmes include Paradosakia (ages 4–11, with 4–7 and 8–11 divisions), Youth Company (ages 12–17), and adult Paradosi (18+). Contact the company for current registration details."
}
```

The existing organization renderer supports `mission` and `membership`; no unsupported programme catalogue or current membership checkout is implied. General email is distinguished from the older Toronto record's youth mailbox. Do not copy that mailbox as the general contact.

Evidence: official homepage, `/paradosakia`, `/paradosi-youth-company`, `/paradosi`; read 2026-09-30. Private source snapshot: `/workspaces/zoi-city/.recovery/logs/paradosi-official-home.html`. The official homepage advertises 2026/2027, but the linked Google registration form still says 2025/2026. Do not import the form's old $150 price, deadlines, or expose it as current registration. No form was submitted.

## Visual evidence and unresolved import quality

Visually inspected the official homepage's 490×630 parade photograph: Paradosi banner, performers/families and Canadian/Greek flags. Private review file: `/workspaces/zoi-city/.recovery/logs/paradosi-photo-review.jpg`. Source URL:

`https://static.wixstatic.com/media/1c1332_9e1a8cbfa751485ca68d58c9cf10c1dd~mv2.jpg/v1/fill/w_490,h_630,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/1c1332_9e1a8cbfa751485ca68d58c9cf10c1dd~mv2.jpg`

This is authentic gallery material, but narrow/low-resolution for an immersive desktop hero. Do not present it as a high-resolution hero. A separately reviewed render/source capture is required before selecting a better hero. Current raw HTML includes blurred 75–124px Wix placeholders; fixing srcset comma parsing does not solve that separate source-render gap. No media fields are included in the proposed write yet.

## Guarded application and acceptance

After independent payload review, request a fresh existing `enrich_sample_lease` for this exact UUID; verify unchanged website, source fingerprint, owner hash, base hash and public eligibility; use `enrich_apply` with source field provenance. Stop if any precondition changed. Read the resulting public projection and owner/base hashes back. Do not call the listing complete from a successful write: rendered desktop/mobile and contact journey remain to be exercised. The two duplicate records remain a separate reconciliation task.

The shared `_images.js` candidate fixes a real cross-family Wix/srcset parsing defect; three new regression tests cover transformation commas, descriptor strings mistakenly used in `src`, and malformed descriptors. Thirty extractor/context/worker/package tests passed locally. It does not imply every affected listing has been reprocessed.

## Facts applied and live acceptance boundary

Reviewed facts above were applied through `enrich_sample_lease` → `enrich_apply` at **2026-09-30T16:46:14.812799Z**, exact lease receipt `bb658b3e-4d8c-42c8-aa4e-2ca8cbda7d39`. The transaction verified exact source fingerprint/website, clean published visibility, no owner, expected base hash, and unchanged nonmachine profile. It verified base fields and owner content again after applying. No direct listing UPDATE, duplicate merge, prices, registration form or photo field was used.

Hash clarification: `88665ba605fe8f19e2e2b35770a8b02d` is the nonmachine listing profile hash; `public_owner_content` is separately empty (`99914b932bd37a50b983c5e7c90ae93b`). Existing writer intentionally adds `_coverage`; excluding only `_enrich` after application would conflate its audit metadata with owner content.

Public `home_entity` readback contains all six reviewed facts, enrichment state `fetched`, classification/design/verification pending. Live canonical `/organization/paradosi-hellenic-dance-company-north-york` renders the programme introduction, mission, membership and correct Contact mailto. The mailto target was inspected; no email was sent or external mail client claimed tested. Desktop and 390×844 mobile screenshots were visually reviewed at `.recovery/logs/paradosi-facts-desktop.png` and `paradosi-facts-mobile.png`. Desktop had no horizontal overflow. The page still has a generic empty gradient cover and is **not visually accepted as the requested premium company home**.

Independent specialist fetched and visually verified the original source photograph (862×1108):
`https://static.wixstatic.com/media/1c1332_9e1a8cbfa751485ca68d58c9cf10c1dd~mv2.jpg`.
It is suitable gallery content, not a wide hero. The current shared media fallback would promote its first gallery image to hero; photo write is intentionally deferred until generic exact-URL `photo_roles: [{url, role: "gallery_only"}]` support is deployed and verified. This role must preserve owner choices and remain effective in hero carousels and family models. The generic source-role candidate is separate from this completed facts write.
