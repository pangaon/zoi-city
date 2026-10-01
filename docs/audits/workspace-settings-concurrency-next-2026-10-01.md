# Independent settings writer audit — next bounded finding

Reviewer: workspace_qa. 1 October 2026. Read-only inspection of production
`csebihpaychdkanjjsmz` function definitions/ACLs and candidate repository settings
code. No business data was changed and no migration was applied.

## Permission parity checked

Production `public.ai_profile_save(uuid,text,text,text,text,text)` checks a
non-null `auth.uid()` and permits only `zoi.ops_role(p_workspace)` values owner,
admin or editor. `assets/suite/settings.js` enables AI voice editing for the same
roles. `zoi.ops_role` derives membership from the current authenticated user's
profile and exact workspace membership, not a client-supplied role.

`ai_profile_get(uuid)` requires current workspace membership. Anonymous execution
is denied for get/save/rename; authenticated execution is granted. The private
`zoi.ai_profiles` table has RLS enabled, no policies and no authenticated SELECT,
INSERT or UPDATE privileges; authenticated also lacks zoi schema USAGE. Anonymous
UPDATE is denied. No direct-table bypass was found in this bounded check.

The deployed `workspace_rename` now restricts to owner/admin membership or recorded
legacy creator/owner, checks current authentication and validates the name. The
UI restricts rename to owner/admin. `zoi_me` and `ops_role` both expose membership
roles only; legacy ownership without membership is therefore a compatibility
boundary, not an AI voice privilege escalation. Broader organizational writers
have not all been assessed by this bounded audit.

## Confirmed source-level defect: concurrent edits overwrite newer settings

Both live writers are unconditional:

- `workspace_rename` performs `UPDATE zoi.workspaces SET name=target_name WHERE
  id=p_workspace` with no expected version/value check.
- `ai_profile_save` upserts all five voice fields and `updated_at=now()`, with no
  expected version or base-value condition.

The settings client sends only desired values. It does not retain or send a
version from initial reads. It reads back after save to confirm desired values;
that detects a later mismatch but does not protect earlier work from another
session. If two authorized editors load voice A, editor one saves B and editor
two later saves stale C, the second write replaces B without a conflict warning.
The same sequence applies to owner/admin workspace renames. This follows directly
from the actual writer predicates; no live destructive reproduction was performed.

This is a product correctness gap for shared organization settings, not evidence
that viewers can mutate them. Current tests cover lost replies, identity and
permission denial, but not two-editor optimistic concurrency.

## Proposed scoped implementation, pending lead ownership assignment

- One specialist owns a new CLI-created migration for versioned identity/voice
  reads and compare-and-set saves, plus isolated PostgreSQL tests. Preserve current
  role checks and exact workspace identity. Do not silently alter unrelated suites.
- Same specialist owns `assets/suite/settings.js` and its focused browser fixture:
  retain loaded versions, submit expected version, display newer server values on
  conflict and require a deliberate choice before applying the user's draft.
- Keep lost-response handling separate from genuine conflicts. A request identity
  or readback receipt must establish whether the exact save succeeded; a transient
  transport failure must not trigger an automatic repeated write.
- Assess legacy unversioned callers before selecting RPC compatibility policy;
  leaving an alternate unrestricted writer would not establish a universal
  concurrency guarantee. Search found settings as the only repository caller of
  `ai_profile_save`; old deployed clients still need an explicit compatibility plan.
- Lead owns schema review/application, release and deployed acceptance. Root shell
  callbacks should continue to update organization identity only after confirmed
  server results. Native currently hands off to web settings; no native editor is
  implied by this correction.

Required evidence: two actors/tabs with the same base version; exactly one initial
save succeeds; stale second save leaves data unchanged; deliberate reload/reapply;
permission downgrade; wrong workspace; account switch; lost result recovery; and
390px/1440px conflict interaction. This finding remains open, and does not narrow
or complete the wider SaaS organization scope.

## Concrete proposed API contract

This is a proposal, not implemented code or an approved migration.

`workspace_settings_get(p_workspace uuid) -> jsonb`:

```json
{
  "ok": true,
  "workspace_id": "exact workspace UUID",
  "role": "current server-derived role",
  "identity": {"name": "Current name", "version": "revision UUID"},
  "voice": {
    "business_name": "", "about": "", "tone": "", "languages": "", "sample": "",
    "version": "revision UUID, or null when no profile exists"
  }
}
```

`workspace_settings_save(p_workspace uuid, p_request uuid, p_section text,
p_expected_version uuid, p_values jsonb) -> jsonb`:

- `p_section` is exactly `identity` or `voice`; section-specific allowed fields and
  existing size limits are enforced by the server. Identity requires owner/admin
  or preserved recorded legacy ownership; voice requires owner/admin/editor.
- Check current actor and workspace authorization before both mutation and receipt
  lookup. A client-provided role never grants authority.
- Lock the workspace before comparing the relevant section revision and creating
  an absent voice profile. This also serializes competing first voice inserts.
- Matching version applies the section update and generates a fresh UUID revision.
  Return `{ok:true,request_id,workspace_id,section,version,value}`.
- Mismatching version changes nothing. Return
  `{ok:false,error:"version_conflict",request_id,workspace_id,section,current}`.
  `current` includes current section values and revision under the same permission
  check. Do not automatically resubmit the user's older draft.
- Store an immutable actor/workspace/request-scoped receipt with the section,
  expected revision and desired-values hash. An exact retry returns the original
  outcome without another write; reuse with different inputs fails. Bound request
  creation to prevent unbounded receipt growth. Private receipt tables have no
  client direct access. A current permission denial does not expose an old receipt.
- A separate `workspace_settings_request(p_workspace uuid,p_request uuid)` can
  recover a lost result without resending a draft. It returns only an authorized
  original outcome or explicit unknown; unknown never means safe automatic retry.

Use actual database revision columns, not millisecond timestamps or client hashes
alone. Every permitted writer must advance the relevant revision. Database writes
outside the RPC must also invalidate the revision (e.g. a narrow update trigger).

### Legacy RPC policy and rollout

Unversioned `workspace_rename` and `ai_profile_save` cannot offer optimistic
concurrency because their callers supply no expected version. A wrapper that
reads the latest version before saving would still silently overwrite stale
client drafts. Do not describe such a wrapper as concurrency protection.

Recommended end state: retain legacy signatures for an explicit
`client_upgrade_required` response, but disable their mutations; new clients use
versioned writers. Inventory non-repository callers before enforcement. A staged
rollout can introduce new columns/read/write RPCs, deploy and verify new clients,
then switch legacy writers to upgrade responses. The interval while old writers
remain enabled is explicitly not universal concurrency protection. Final
acceptance requires the legacy mutations to be closed or every authorized writer
to require a real caller-supplied expected version. Current get-only callers such
as `assets/suite/ai.js` can continue through `ai_profile_get` if its permission and
returned voice fields remain compatible.
