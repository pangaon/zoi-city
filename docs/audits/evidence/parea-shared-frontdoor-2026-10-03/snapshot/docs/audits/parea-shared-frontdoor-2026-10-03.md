# One reusable Parea front door for event homes

Candidate only; no deployment or live writes by this lane. Parent owns the coherent release. Baseline f55489f834c7c2fe6ae1f0192eea99f519583163; the retained production evidence is separate from candidate rendering.

## Result and scope

The existing Signature customer controller now also serves generic event homes across the four owner designs. Its shared rows assign whole tickets, capture optional names/email/mobile, offer a supported-device contact picker with manual fallback, reuse the existing private account saved-group suite, and prepare an individually reviewed SMS/email message. Contacts stay in page memory; saved groups keep only their existing names/whole-ticket schema. Messages contain the intended recipient's quantity and public event URL, not contacts belonging to other guests, private claim tokens, payment requests or fake booking receipts.

Eight runtime files are owned here: Signature customer module/CSS/experience, generic event renderer/client/CSS, invitation-share, and the minimal room-integration consumer hook. The room producer explicitly agreed onPreference and onContinue callbacks; no scene, geometry, model or room CSS was edited. Montréal's validated alphanumeric source ID survives the room selection and Continue into the same planner. Toronto retains source booth labels and actual source table price bands. Generic events—including sparse events and a cleared floor-plan field—never inherit Toronto prices. An absent price remains null/“Price to confirm.” Owner section visibility remains authoritative. Venue/promoter families retain their own enquiries.

The Parea hero action now reaches planning; the separate Explore action still opens the room. Contact fields expand only when wanted, crew controls remain reachable at each step, and each message is opened for review before a composer link appears. Existing private invitation capability validation is unchanged; its composer helper gained an optional sanitized subject with the same private default.

## Source and operating truth

The read-only source audit `parea-web-frontdoor-read-only-2026-10-03` confirms Toronto UUID4546481e-8995-482a-a0af-f0017613f187 and Montréal UUID9b241a00-f0c9-5748-8e22-79e2e0b57f79. Both actual anonymous inventory replies were configured=false with no tables. The separate Toronto asset-overlay journey again received actual home_entity200 and table_inventory_map200/configured=false at390/1440. It used production HTML/API with local candidate assets, so it is not a deployed-candidate pass.

Review offers an exact-event `/tickets/hosts/?event=<verified UUID>` handoff into the existing operating suite and an explicit current inventory check. It does not transfer the public draft into an authorized allocation or create secure guest links. Inventory setup, host grants, confirmed allocations and each guest's allowed payment choices remain server-owned. Actual public tests cannot claim live holds/payment/invitation delivery while those two events remain unconfigured. Private secure links and pay-at-door/unpaid were exercised separately in the existing controlled host operating fixture, not invented by this public planner. Native continues its existing web handoff; this packet edits no native code.

## Exercised evidence

All paths below are under `docs/audits/evidence/parea-shared-frontdoor-2026-10-03`.

- `browser-final-retry/report.json`: six controlled opened Toronto/Montréal/sparse journeys at390/1440. Assign3/1/5, optional email/mobile, opened contact confirmation, reviewed SMS/email with exact message encoding, source subtotal$1800 only for Toronto table9, null Montréal/sparse prices, exact host URLs, inventory error followed by explicit successful retry, saved-account crew reuse without contact carryover, over-allocation refusal, account cleanup, zero writes/errors/overflow.
- `integration-final/report.json`: six full generic SSR→actual client journeys from retained current Montréal public content, sparse event and cleared-plan variants at390/1440. The actual room scene selects10A and continues into the shared planner; price remains unknown. Anonymous saved groups correctly ask for sign-in. No duplicate planner, page error or horizontal overflow. Exact consumed current content is `integration-final/montreal-public-content.json`; reproduction may supply PAREA_SOURCE_FILE to avoid a mutable network dependency.
- `toronto-overlay/report.json`: two production-HTML/real-API journeys with candidate local assets. Real hero→room9→planner3/1/5→reviewed SMS/email→actual unconfigured inventory and exact event operating link. Both real RPCs200, zero blocked writes/errors/overflow. Every overlay's bytes/hash is retained in the report.
- `host-operating`: unchanged existing host roster browser fixture at390/1440 passed dynamic quota, individual secure links, lost-response freeze/recovery, account/surface cleanup and recipient pay-at-door remaining unpaid. This is controlled operating evidence, not live ticket delivery.
- Focused units51passed, contact-picker units4passed, Signature bridge/startup/private-plan/source-table units18passed. The Signature bridge fixtures gained the new real controller methods; the intentional Parea-CTA behavior is asserted alongside the still-working explicit room action. Private save/account/BFCache guards remain.

Representative screenshots were opened visually: final Toronto390 compact rows, Montréal390 contact dialog, sparse1440 rows, and full generic Montréal390/1440 review. Full opened-work-panel screenshots retain every person/action beyond a single viewport.

## Preserved failures and corrections

`first-dialog-layout-failure` retains the first phone screenshot/report. Existing responsive grid placement forced nested controls into incorrect columns; a dialog nested inside the hidden introduction could not be used. Scoped row rules were corrected and the dialog moved to the shell. `browser-v2` retains the first passing run whose contact labels inherited low-contrast light-picker tokens; scoped dark tokens correct it in the final captures.

`first-canonical-double-mount-failure` retains the first full canonical report. The shared controller originally looked only for a child shell and nested another shell when passed the shell itself. It now recognizes its own root, with a full SSR/client browser count of one. `signature-integration-unit-first-old-fixture-failure.log` retains missing-new-method mock failures; updated bridge fixtures record setEventId and showGroupSetup and assert both current journeys without weakening save/privacy assertions.

## Reproduction and release gates

NODE_PATH=$PWD/node_modules node tests/browser/parea-web-frontdoor-audit/candidate.cjs

PAREA_SOURCE_FILE=<frozen integration-final/montreal-public-content.json> NODE_PATH=$PWD/node_modules node tests/browser/parea-web-frontdoor-audit/integration.cjs

NODE_PATH=$PWD/node_modules node tests/browser/parea-web-frontdoor-audit/live-overlay.cjs

QA_OUTPUT_DIR=<separate reviewer folder> NODE_PATH=$PWD/node_modules node tests/browser/parea-roster/verify.cjs

Independent frozen review, parent exact staged checks/version chain, deployment and actual deployed generic/Toronto journeys remain release gates. The source-takeover and official-source-policy packets are unchanged. No new provider delivery, online collection, reservation stock or alternate source was added.
