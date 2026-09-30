# Canonical home lookup

The public canonical lookup normalized 6,233 business candidates to select an exact identity match. A partial index on entity type and fixed-size hashes now prefilters candidates. Full identity comparisons remain, so a hash collision cannot merge identities. Visibility, ranking, owner content and null clears are unchanged.

Five isolated PostgreSQL checks compare exact public payloads before and after, current moderation changes, index use and long names. The specialist measured 120 ms before and 6.8 ms after on the same 6,000-row fixture. Root reran the integration suite successfully. Production had a 241 ms warm scan, but the reported 3-second timeout was not reproduced: this is a measured optimization, not proof of the complete outage cause.

Production release and timing must be verified separately. No business content is changed.
