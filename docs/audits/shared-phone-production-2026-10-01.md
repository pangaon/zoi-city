# Shared contact release — 2026-10-01

Production commit `3a1978b546bcd6ad36193b89c8e12612f16439da`; Vercel deployment https://vercel.com/pangaons-projects/zoi-city/79qmsjaDHqTHDji82TmMVS1t1LdK. CI `36816945665` succeeded, including native checks.

Exact staged tree `ebbc2cf77d705e2a1b159051eb2a15068792d39c` passed `verify:local` (258 node:test files and two standalone suites). The first release candidate failed an existing parish source-phone expectation; source-priority handling was restored and valid base fallback preserved, with an additional regression for imported placeholder versus explicit owner clear. Native `tsc --noEmit` passed. Required real database suites are separate from locally skipped database tests; this change makes no schema changes.

Enrichment worker version50 ACTIVE, bundle `7c6b197814192dc2c3e26c1852739f26bb2ac3e0d1f520c939a73d91c6b25d92`. All15 deployed files compared byte-for-byte with the candidate. Prior custom-auth configuration preserved. Only entrypoint changed and `_phone.js` added; other13 worker files unchanged. Public shared modules also matched manifest hashes.

Actual production map selection and contact journeys passed at390/1440 widths with normal and short/reduced-motion views. Each returned the source-reviewed Stalactites coordinate and `tel:+61396633316`; no page exceptions. Evidence `/tmp/phone-release-map-live.json` and `/tmp/phone-release-map-live.log`. No calls placed. Six controlled mounted preview cases separately cover placeholder suppression, valid contact, fallback and save-on-device; these are controlled tests, not six production listings.

Shared implementation covers restaurant/hospitality/person/parish/event data, owner projection, map/discovery previews, metadata, native profile code and extraction. Explicit owner/profile clears remain authoritative. This is not full-catalogue contact verification, native store distribution or a claim that every profile has been visually accepted.
