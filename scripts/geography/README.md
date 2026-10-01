# Reviewed map corrections

Coordinate collection is read-only. A source-published number is a candidate, not an automatically approved street pin. Keep source bytes and exact record snapshots with the report. Review source identity, full address, locality plausibility and whether the number identifies the venue rather than a city centre, map camera, parking or neighbouring business.

`node scripts/geography/source-coordinate-audit.mjs SNAPSHOTS_JSON EVIDENCE_DIRECTORY`
collects a bounded batch of one to three distinct listings. Each returned
`evidence_file` links content-hashed report, allowlisted listing snapshot and
captured source artifacts. The `.source.html` file contains the exact decoded
UTF-8 text inspected by the extractor, not the original network byte stream.
Owner-managed or ineligible listings are refused before fetching. Existing
identical artifacts are reused; conflicting file contents fail the run rather
than overwriting evidence. Keep the evidence directory private.
The snapshot retains a supplied `database_snapshot` hash for the later guarded
writer. Evidence records `ownership_gate` when either ownership field refuses
collection, without copying a private workspace identifier.

The module API also accepts `identityReviews`, keyed by listing ID, for explicit
source-name reconciliation; these reviews are retained separately and their
hashes remain attached to candidates. Collection never applies coordinates.
Squarespace and name-alias candidates still require a compatible reviewed writer
and independent identity/address/locality acceptance before production use.

`reviewed-coordinate-request.mjs REQUEST_UUID REPORT REVIEW SINGLE_SNAPSHOT OUTPUT` prepares an immutable RPC request file (exclusive create, no network). Use an explicit UUID and retain the same file when recovering an uncertain response. It preserves exact report bytes because the server hashes those bytes. Review and source collector must be distinct. Preparation is not authorization; production apply still performs current-row, source, ownership and evidence checks.

The service-only `geography_review_apply` RPC accepts the prepared `arguments` object. It locks the listing, refuses concurrent changes, records before/after geography and preserves unrelated fields. Existing owners' records are refused. Anonymous and signed-in application users cannot invoke it. Never put service credentials in a browser or mobile client.

Retain the returned `after_snapshot` and request UUID. `geography_review_revert` permits reversal only while the entire row still matches and has no owner; it restores the original geographic fields. Do not overwrite a later owner edit to undo enrichment.

After applying, check the real public map projection, visible pin and selected-place actions on phone and desktop. Successful SQL is not map journey acceptance. Apply limited independently reviewed batches; do not promote coarse source coordinates globally.
