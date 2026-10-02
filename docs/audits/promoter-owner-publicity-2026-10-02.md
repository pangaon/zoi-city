# Promoter owner announcements — 2 October 2026

## Existing contract and reproduced gap

The existing publicity editor, validator, versioned home_content_save/profile projection and Signature renderer already support organiser-reported sales counts with source/reporting time/expiry, curated posts and highlights. They do not represent live ticket inventory or automatic feeds. Signature's centered client header, montage opening and optional Facebook timeline are existing capabilities, not newly built here.

Business home previously exposed Event announcements only to event/venue records or one hardcoded Signature UUID. Other current `business_type:concert_promoter` records could project public owner announcements but could not edit them. The actual public dispatcher sends generic promoter records to `events/promoter.mjs`; an initial proposed generic.mjs change was removed after tracing dispatch. Final generic.mjs is unchanged.

## Scoped implementation

Business home now admits the existing editor for business records whose current authorized profile explicitly identifies concert_promoter. Other businesses are excluded; an explicit cleared/changed type also disables Signature's legacy fallback. Event/venue eligibility remains intact. Existing current actor/workspace checks, versioned save, request receipts, owner clears and recovery behavior are unchanged.

The real promoter template places a dated sales badge within only the concert card whose published show URL exactly matches the announcement event URL. Relative `/event/...` links resolve against Zoi; unrelated concerts, venue totals and tours do not inherit the number. Count, source, timestamp, expiry and owner provenance use existing validators. No show means no milestone. Explicit null owner publicity suppresses imported/profile fallback. Posts/highlights retain the original curated provider navigation.

Shared milestone source controls now have44×44px minimum targets in promoter, event and Signature layouts, with12px date text. No new sales or provider data was invented.

## Controlled journey evidence

13 focused publicity tests pass (`/tmp/promoter-publicity-unit.log`). Actual Business home editor390/1440: enter count300 as explicitly controlled test data, source/report/expiry and a curated post; preview; save through existing version/request shape; remount/readback; canonical public render; keyboard navigation to exact report source and original post. Wrong-event, expired, sparse and clear/remount cases reject sales display. Nonpromoter profile no longer mounts the announcements editor. Event and Signature cases additionally verify shared touch target dimensions and overflow.

Artifacts `/tmp/promoter-publicity`; browser log `/tmp/promoter-publicity-browser.log`. Initial touch target regression found Signature's more-specific40px rule overriding shared44px; final shared selector includes Signature and is rechecked. Phone/desktop screenshots inspected. Database persistence is a controlled existing-contract fixture; current production schema/readback was not probed. No production/customer writes, deployment, provider playback, social synchronization or actual300-ticket claim.

Lead owns cache entrypoints/release. Independent review still required. Owner typed statements remain dated organiser reports, never availability, payment receipt, venue capacity or independently audited sales.

The Signature fixture controls external requests without real image payloads, so its screenshot contains broken source-image placeholders. That case verifies the sales card/touch layout only; it is not a fresh Signature imagery acceptance. The promoter fixture intentionally has no source photograph. No actual source asset was replaced.
