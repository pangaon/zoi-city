# Reviewed Stalactites contact correction

Applied once through the existing lease-bound `public.enrich_apply` writer at 2026-10-01 04:42:04 UTC. Listing `054dd95e-5253-4a86-9630-fe91c3f29c90`; receipt `applied:true`. Replaced machine placeholder `5555555555` with official-source JSON-LD phone `+61396633316`.

Independent reviewer: workspace_qa. Retained source HTML SHA256 `96d7c36196e622fa0cb9176bc1793a61659f3fdfc0d352df544ba1efba84e87c`; report SHA256 `0434091b469271368c0b83ec47abfe5aa960f9fecd8363a73c12364e1c8760bf`. Bound batch and review are retained under `.recovery/stalactites-phone-review-20261001/` in the parent workspace. Final transaction locked and checked whole post-lease row snapshot `4c5cbc2ad9ee04b4f6be7123b04c99ca` before applying.

Before/after base-record hash excluding profile and updated_at remained `c59e8a766bb07937e24e2b5fd51f699f`. Profile excluding machine enrichment and coverage remained `7cf18cdf4b92ac40aaf7d4675b43c38a`. Official geography, ownership and top-level phone null preserved. Prior email, social links, menu, ordering, booking, language, description and tagline preserved; writer refreshed evidence/status and reset downstream quality checks as designed.

Production browser verification: `tests/browser/map-reviewed-pin/verify.cjs`, `EXPECT_PHONE_FIXED=1`, four actual cases (390/1440 widths, normal and reduced-motion/short-height). All passed; each exposed `tel:+61396633316`, the reviewed coordinate pair and zero page exceptions. No phone call was placed. Raw evidence `/tmp/stalactites-phone-live.json` and log `/tmp/stalactites-phone-live.log`.

Boundary: this is one reviewed source-data correction. Shared placeholder prevention across renderer families and the enrichment worker is independently accepted but not yet released. This does not establish full-catalogue contact correctness.
