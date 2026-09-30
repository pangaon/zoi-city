# VIP Billiards source identity review

Read-only live listing checked 2026-09-30: `d5d1c169-031f-4737-85da-2e72c76e8c39`, VIP Billiards & Lounge, stored website `http://www.billiardsacademy.ca/`.

The machine namespace records checked_at 2026-09-17 and the same source_url. It contains tagline `KOMPAS.com`, Indonesian MALUKU4D jackpot/wagering description, Jakarta address, kompascom social accounts, and zoomacademia.com logo/photos. This is concrete incompatible source content. It does not establish whether the cause was a redirect, compromised/reassigned source, or older extraction error. Current source retrieval failed because robots.txt was unreachable; no bypass attempted. No owner fields or database records were changed.

The worker manually vets each redirect for network safety, but its successful generic path accepts the final document without comparing business identity. Image CDN host differences alone are NOT proof of contamination and should not be banned.

## Isolated candidate, not deployed

`supabase/functions/zoi-enrich/_source-identity.js` exports a pure machine-source review decision; four regression groups pass in `tests/unit/source-identity-gate.test.mjs`.

- Unexpected document hostname changes require review; http→https and www aliases pass. Legitimate migrations/subdomains would also need review: this deliberately conservative policy requires rollout review before integration.
- Same-host conflicting dominant wagering/payout metadata without the expected identity also requires review. Legitimate named gaming businesses and ordinary promotions are not automatically blocked.
- It does not mutate inputs or inspect/replace authoritative owner images.

Proposed integration point: after successful fetch and before member/generic extraction; perform host gate first, then primary metadata identity check before supplementary crawling/apply. Use existing error-preservation path and stable review reason, never replace last-good content with this page. Existing contaminated machine data would require separately guarded quarantine and public projection review; the candidate alone does not remove it. No cron, worker deployment, dispatch, or database quarantine was executed.
