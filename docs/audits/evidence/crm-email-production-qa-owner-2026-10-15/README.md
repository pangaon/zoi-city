This is a QA-only harness for existing Contacts → Email draft save/reopen and
uncertain-response recovery. It does not change product, session, Auth, schema,
contact, consent or delivery code. The committed request is disabled.

The lead alone integrates reviewed source, confirms deployed web bytes, enables
an exact request and executes the production run. Admission requires public
`pangaon/zoi-city`, a single-parent request-only main push, first attempt, fixed
QA workspace, maximum30-minute expiry, exact CODE_FILES and WEB_FILES hashes,
and SHA256 of the exact pre-provisioned fixture tag. The literal tag stays in
session memory, never in the repository request, logs or artifacts. A missing
fixture fails before draft writes. There is no contact-create fallback.

CODE_FILES and WEB_FILES are exported by scripts/auth-qa/crm-email-browser-ci.mjs.
The enabled request has exactly these fields:
`enabled,purpose,request_id,workspace,parent_sha,issued_at,expires_at,code_sha256,web_sha256,fixture_tag_sha256`.
Purpose is `dedicated-crm-email-browser-v1`; workspace comes from unchanged QA.workspace.
The root-controlled synthetic fixture digest is provided to the lead separately.
Do not reissue/renew founder access or acquire credentials in local QA.

The trusted workflow reuses unchanged withQaSession and serviceCredential from
the existing Company QA model. Credentials/session remain memory-only; subprocess
environment is scrubbed, and only fixed boolean/count evidence is uploaded after
canonical cleanup and session logout. No browser source, contacts, tags, network
responses, screenshots, token, SID or payload is uploaded.

The browser uses the real public social shell, mounted modules and canonical
RPCs. Fixed nonce1 is request_id; nonce2 is a deterministic SHA-derived v4 UUID.
Only two exact synthetic saves are permitted. The second fetch consumes actual
successful server bytes, then intentionally throws before the app receives them.
The real metadata-only recovery marker is carried in coordinator memory across
reload; no original payload is restored. The actual Check saved receipt control
must recover and reopen the saved current draft. This production test uses a
fixed390px viewport. Live resizing/1440px acceptance is outside this harness.

Every exit after attempted browser entry checks/cancels both original nonces.
Only exact immutable synthetic snapshot + current draft fields + actor/workspace
and fixture-tag digest permit canonical email_campaign_delete. Removed receipt
and canonical list absence confirm cleanup. A lost delete reply is resolved by
its original receipt; no create is retried. Failure on one draft does not skip
the other. An always cleanup workflow step can run for the original request up
to one hour after expiry, but cannot create, open a browser or admit a new run.
Immutable receipts/cancellation tombstones remain. Root separately removes the
pre-provisioned synthetic contact after acceptance.

Offline verification (no credentials, production requests or provider calls):

```sh
node --test tests/unit/crm-email-browser-qa.test.mjs \
  tests/unit/company-private-browser-qa.test.mjs tests/unit/authenticated-qa.test.mjs
CRM_QA_TREE=/absolute/review/tree OUTPUT_DIR=/tmp/independent-crm-mounted \
  CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome \
  node docs/audits/evidence/crm-email-production-qa-owner-2026-10-15/controlled-mounted.mjs
```

The latter runs the actual social HTML/assets and new single-client CDP driver
through an exclusive localhost HTTP CONNECT proxy and ephemeral local TLS server.
Every allowed host tunnels only to that fixture; all others are refused. RPCs
use a synthetic in-memory canonical-shaped store. Its invalid test JWT is never
sent to production and is not authenticated product evidence. Actual PostgreSQL
and Auth acceptance remain the lead's real production run after review/admission.
The disabled-request unit launches exact CLI children in isolated temporary CWDs;
it also passes with an enabled synthetic outer repository request.
