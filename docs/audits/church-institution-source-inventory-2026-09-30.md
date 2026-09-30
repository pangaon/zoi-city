# Public church institutional-root source audit

Read-only scope: public, clean/cleared, nonhidden church records whose stored website is the exact ortodossia.it root.85 matched; all85 passed through the frozen JS source-scope classifier as requiring institutional-scope review. All85 share one imported phone, one imported email and one imported social object. These are not85 independently sourced parish contact records.

No matched record has an owner workspace, and the authoritative public_owner_content function returns an empty object for all85. Current base identity/address/city data is outside this quarantine. Names include parishes, churches, shrines and monasteries; they are individual places, not the archdiocese homepage identity. A shared phone might coincidentally serve multiple entities, but the root-page extraction does not establish it as each place's direct contact. The correction marks that scope unresolved rather than claiming a verified replacement.

Brescia's record was already quarantined by root after the canary. Proposal ops/church-institution-scope-quarantine-proposal.sql contains the remaining84 exact IDs, current machine hashes and source fingerprints. It fails atomically if any record changes ownership, public visibility, source or evidence. It retains original machine data and adds source_scope_mismatch/review markers so the reviewed public church adapter excludes institutional fields. No base or explicit owner data is removed. The proposal is not a production write receipt and has not been executed by this audit.

The only additional relevant institution domain found in the inspected repository evidence was goarch.org (official calendar reference). No public church listing used that exact root website. No unverified institution host was added to the worker allowlist or quarantine proposal.

Private raw snapshot: .recovery/logs/church-institution-audit-private.json (0600). Exact hashed proposal inventory: church-institution-audit-summary.json. No source fetch, crawler dispatch or cron change was performed. This is a bounded source-scope inventory, not full individual-home acceptance.

Root execution receipt: the exact guarded 84-record proposal was applied once on 2026-09-30 after public renderer deployment b607fe9. The database returned 85 total quarantined records, including the previously restored canary. No cron schedule changed. The original proposal must not be replayed; its old machine-hash guards now fail.
