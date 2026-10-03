# Company and private document current-session authority

The lead independently reviewed the producer's immutable candidate, replayed its
database journeys and installed the bounded authority correction. This fixes
session expiry and changing permissions around Company operations and private
document access. It is not acceptance of government filing integrations or
production customer file transactions.

Source: producer manifest `2e8250426105928d6ddd9cec5b3366943a87650b917dca5b70dd1590bf549e03`;
all 29 owned and dependency entries matched. SQL SHA256
`b060b2ffae9bce61330282b61933c3741e133abadfe33f865901d4d6846f32fa`.
The exact local generated source remains
`supabase/migrations/20261003032635_company_document_current_session.sql`.
The actual provider-installed migration ledger entry is **20261003041152**,
`company_document_current_session`. These timestamps differ because the provider
assigned the installed entry; the local source has not been renamed or the live
ledger rewritten. Future bulk migration deployment must account for this recorded
mapping and existing history before applying files.

The independent PostgreSQL replay passed 33 groups and observed 17 real lock
waits. It reproduced the legacy expired-session write before the candidate and
exercised expiry, revocation, banned/deleted actors, anonymous and malformed
claims, cross-account access, missing roles, version conflicts, lost responses,
receipt cancellation, private document reservation/version changes, natural
expiry while waiting for a lock and permission changes during a save. The two
trusted document workers retain their prior function definitions.

Fresh production preflight matched all 19 original function definitions and
their privileges, owners, security-definer setting and empty search paths. The
installed readback matched all 13 changed bodies to the frozen SQL, confirmed
both new helpers and both authenticated SELECT policy changes, preserved all
19 original privilege contracts and six unchanged original function bodies.
The private authority helper is not executable by anonymous, authenticated or
service-role clients; the policy helper permits authenticated execution only
among those three client roles.

Twelve actual authenticated-role RPC calls with missing session claims were
checked inside an explicitly rolled-back production transaction. Each refused
with SQLSTATE 42501 and `suite_session_unavailable`; no customer records were
written. Security advisors had six baseline findings before and after, with no
new findings or findings on these helpers. This does not declare the entire
project free of advisor findings.

Separate retained evidence is in
`docs/audits/evidence/company-document-current-session-parent-2026-10-03/`:
`parent-replay.log`, `actual-lock-waits.json`, and `installed-readback.json`.
The readback contains static function/privilege metadata, the exact ledger,
rollback refusal result and advisor comparison, not customer credentials.

The correction is installed in the database. Its local migration, generator,
fixture and acceptance evidence await the next coherent code release. Real
authenticated customer lifecycle acceptance, physical native file sharing,
provider filing and the wider set of 24 shared session-helper consumers remain
separate work; none are converted to a pass by this correction.
