# Rendered-source run 36792488890: three repair outcomes

Immutable artifact `rendered-source-evidence-36792488890-1` downloaded locally; all three capture filenames match canonical JSON SHA256. Each pending payload has exactly one successful apply receipt, but all three payloads contain only `crawl_status:error` and a repair reason. The workflow completed reporting repairs; it did not enrich three profiles.

A single bounded authoritative read confirmed the following exact records are published/clean, unowned, have no active lease, and retain the captured source fingerprint. This observation is not a future write precondition; recheck when leasing.

| Listing | ID | Source | Result |
|---|---|---|---|
| Melanthi Hotel, Makrinitsa, Greece | 04ae2053-1e91-49b2-bd31-19a5e9158a2a | https://www.melanthi.gr/ | source_render_timeout |
| Moongarden, Molyvos, Greece | 07645d75-5546-4278-b61b-4aa29f942102 | https://www.moongarden.gr/en | rendered_source_identity_review |
| Comunità Ellenica delle Marche, Italy | 08106b1c-4664-47a1-b7cc-cd7cf575b050 | http://www.comunitaellenicamarche.weebly.com/ | unsafe_source_url |

## Actionable reviewed source: Moongarden

Capture `b52a39261df57e7c8cad68f164bfc7427439319cfd9bd83aa45494e8dbf8ad33` contains an actual official same-host page. Its title is “Moongarden Rooms in Molyvos | complex of country guest houses - rooms in Molyvos Lesvos”; the queue intentionally requires exact normalized title equality and therefore routes this to human review. This is a justified review case, not a reason to weaken unattended identity checks.

Official homepage and retained HTML independently name Moongarden, guest houses in Molyvos/Mithymna, Lesvos, olive trees/gardens/pool and telephone +30 22530-72170. The captured profile contains extra fields that should not be blindly copied: 24/7 hours without independently checked operational meaning, coordinates not independently checked for precision, a COVID promotional banner and other unreviewed imagery.

Prepared isolated review-only `ops/moongarden-reviewed-source-proposal.json`: short factual description, tagline, published phone, official Facebook link, language and two source photographs. Both images fetched once through the existing public DNS/robots/byte-limited source transport, returned HTTP200, and were visually inspected. Bedroom photo is 1920×830 (192219 bytes); aerial property/pool photo is 605×405 (62034 bytes), retained as gallery resolution rather than enlarged hero. URLs and original byte hashes are recorded in the proposal. No invented booking capability, availability, rating, exact coordinates or reception hours.

Apply requires independent review, a fresh authorized existing lease and the same fingerprint. A separately hashed reviewed derivative must contain only approved fields while retaining the original report/source/render references; never relabel or edit the immutable capture. Existing reviewed-batch and apply guards remain mandatory, followed by owner/base preservation checks and actual rendered acceptance. No lease or write performed here.

## Other two records

Melanthi: report records only `source_render_timeout`; it does not identify DNS, navigation, body or settling as the precise stalled phase. No source retry was made and no claim of incorrect timeout configuration follows from this artifact. A separately authorized diagnostic capture with safe stage timing would be needed before altering transport budgets.

Comunità: stored HTTP URL is outside the rendered capture's HTTPS-only source contract, so rejection is correct. One guarded check of the exact same host with HTTPS failed with EPROTO before identity content could be verified. Do not mechanically change the stored URL, remove the www label, bypass TLS/robots or loosen the source guard. Verified official alternative identity is still required.

## Boundaries

Only the assigned audit and isolated JSON proposal were added. No shared pipeline changes, database mutations, workflow retries, deployment or staging. Current successful error receipts mean these sources are accounted for, not complete. This review supports one bounded content correction after approval and proper leasing, not broad inventory completion.

## Independently reviewed derivative prepared

Lead independently inspected both original image byte files and official homepage identity/location/phone. Immutable, read-only local files now live under `.recovery/moongarden-reviewed/`:

- `22c10057048c373e7b72de6d3d325b0dd070399b8cf751805f629a59573e3d65.report.json`
- `22c10057048c373e7b72de6d3d325b0dd070399b8cf751805f629a59573e3d65.review.json`

The derivative retains original source/render hashes and `reviewed_derivative_of` pointing at the original capture hash; its profile contains only the eight approved fields. Original capture is unchanged. The review receipt records independent identity/image review and still requires a fresh matching lease.

Materialize only after the lead obtains an exact authorized lease plus the original stored lease fingerprint (never inferred from the candidate):

```sh
node .recovery/moongarden-reviewed/materialize.mjs /absolute/private/current-lease.json /absolute/private/moongarden-pending-batch.json
```

The helper calls the existing `reviewedEnrichmentBatch`, writes with exclusive creation/0600, and performs no RPC. It requires exact ID/slug/unowned state, source/lease/fingerprint matching, and original capture chain. It refuses any additional meaningful existing machine fields outside the approved subset instead of silently deleting them. Such fields require a separately reviewed preservation merge/new derivative; error/lease metadata can be superseded. It adds original capture hash to the persisted rendered evidence metadata. Four local synthetic tests passed: exact materialization; changed fingerprint, owner-managed state and unexpected useful machine field each refused. Synthetic output was deleted. No production lease or payload was fabricated or applied by this specialist.

The existing apply writes only machine `_enrich` and coverage, preserving base/owner profile siblings subject to its existing fingerprint guards. Lead must still snapshot/recheck base/owner state, confirm the exact receipt, and exercise the actual public page after applying. These files do not constitute production publication.


## Applied by lead; independently read back

Lead performed the guarded targeted sample lease and existing `public.enrich_apply` transaction. Specialist read-only verification confirms `crawl_status:ok`, reviewed hash `22c10057048c373e7b72de6d3d325b0dd070399b8cf751805f629a59573e3d65`, original capture hash preserved, and no remaining lease. Source fingerprint remains `2ca62084930a4cc1e4b706aeb917984e`; public owner hash remains `99914b932bd37a50b983c5e7c90ae93b`; protected base hash excluding profile/updated_at/search_tsv remains `37c6d8359d09df75bcb70a5da3b217fc`. Stored profile contains the approved description, telephone and two photos; hours/geo remain absent. No useful prior machine fields were discarded (lead confirmed prior machine namespace contained only error metadata).

Canonical `/travel-place/moongarden-molyvos` returned HTTP200 with reviewed description/phone and both photograph URLs; promotional banner absent. An initial guessed `/place/` route returned404 and was corrected using the actual typeSlug contract; it was not treated as a content failure. These are persisted/public-HTML checks, separate from lead browser acceptance. Lease identifier remains private and is not recorded here. Other two sources remain unresolved. The source enrichment succeeded; the later discovered shared hospitality social-render gap is tracked as a separate implementation task.
