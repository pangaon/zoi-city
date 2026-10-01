# Reviewed map corrections

Coordinate collection is read-only. A source-published number is a candidate, not an automatically approved street pin. Keep source bytes and exact record snapshots with the report. Review source identity, full address, locality plausibility and whether the number identifies the venue rather than a city centre, map camera, parking or neighbouring business.

`reviewed-coordinate-request.mjs REQUEST_UUID REPORT REVIEW SINGLE_SNAPSHOT OUTPUT` prepares an immutable RPC request file (exclusive create, no network). Use an explicit UUID and retain the same file when recovering an uncertain response. It preserves exact report bytes because the server hashes those bytes. Review and source collector must be distinct. Preparation is not authorization; production apply still performs current-row, source, ownership and evidence checks.

The service-only `geography_review_apply` RPC accepts the prepared `arguments` object. It locks the listing, refuses concurrent changes, records before/after geography and preserves unrelated fields. Existing owners' records are refused. Anonymous and signed-in application users cannot invoke it. Never put service credentials in a browser or mobile client.

Retain the returned `after_snapshot` and request UUID. `geography_review_revert` permits reversal only while the entire row still matches and has no owner; it restores the original geographic fields. Do not overwrite a later owner edit to undo enrichment.

After applying, check the real public map projection, visible pin and selected-place actions on phone and desktop. Successful SQL is not map journey acceptance. Apply limited independently reviewed batches; do not promote coarse source coordinates globally.
