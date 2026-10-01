# Sponsor placement backend release

Applied reviewed SQL hashes `f2483d8e0202edd84213d4b382e0f82e04a8877fa37be2f8426f0a82c72c8fea` and `82a6f01e78e9ea73948701ef6391c2506a12b69c128a09d6ca01a07928df0a72` to the production project. Remote migration versions are20261001045527 (festival_sponsor_placements) and20261001045545 (festival_public_placement_configuration); corresponding local migration filenames retain their creation timestamps.

Root independently reran15 real PostgreSQL placement groups and7 public configuration groups, all passed. These use isolated fixtures, not customer records. Operator17journeys independently accepted at390/1440. Public stream unit and mounted WebGL tests passed, including canonical identity rejection, camera preservation, focused card refresh, broken image fallback, expiry, revocation, failure and destruction.

Actual production anonymous-role read for Toronto event `4546481e-8995-482a-a0af-f0017613f187` returned configuration_version:null and placements:[] as expected. No sponsor, ownership, payment, customer application or artwork approval was fabricated. Frontend deployment evidence is recorded separately.

Security advisors inspected after DDL. Four new private tables have RLS and no client policies/direct client grants, intentionally accessible through scoped writers only. Two public SECURITY DEFINER readers and authenticated operator/writers are expected flagged surfaces; tests verify their explicit authorization/public-field boundaries. No new mutable-search-path finding belongs to these functions. Existing project-wide advisory findings remain open; this is not a clean-security claim.

Current capability is externally hosted artwork with explicit authorized approval and bounded scheduling in front/side furnished lounge configurations. It is not uploaded-byte inspection, product checkout, table inventory, whole-room table assignment, or a connected Montréal placement experience.
