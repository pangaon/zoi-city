# Coordinate preparer signoff fields — independent review

Accepted the bounded preparer correction. Five unit tests independently pass. Additional independent probes using the retained actual AMARA report and v2 review confirm the valid reviewed packet prepares without writes, removing any candidate_address/destination_purpose/destination_url rejects, and unsupported Squarespace evidence rejects even with its report hash recomputed.

The preparer now requires a nonempty structured candidate street/city/country, exact canonical equality with the independently signed-off candidate address, writer-supported evidence kind and explicit place_location purpose/exact Google directions URL for destination candidates. It still preserves exact report bytes and only prepares transport. The privileged server remains authoritative for source binding, ownership, current database snapshot and locality verification. No production request or coordinate write occurred during this review.

SHA256 reviewed-coordinate-request.mjs: `4f3b09910deeebe5b5b61ec75663595b51580f48b0956a7113c1b1971250bf8d`.
SHA256 reviewed-coordinate-request.test.mjs: `eea6b572226fe36928dec66473dd8ed951cbd4a5a902b5d1865d93a72644b234`.
