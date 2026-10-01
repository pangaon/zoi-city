# Audience and assets role parity — bounded proposal

## Observed authorization

Catalog-only source inspection; no customer contact or asset rows fetched.

| Operation | Current server rule | Proposed rule |
| --- | --- | --- |
| asset_list(uuid) | assert_ws: any member or recorded creator/owner | unchanged read access |
| audience_list(uuid,text,text) | same | unchanged read access |
| asset_save(uuid,text,text,text,integer,integer,integer) | same | owner/admin/editor |
| asset_delete(uuid,uuid) | same | owner/admin/editor |
| audience_upsert(uuid,text,text,text,text,text[],text,uuid) | same | owner/admin/editor |
| audience_import(uuid,jsonb) | same | owner/admin/editor |
| audience_delete(uuid,uuid) | same | owner/admin/editor |
| email_consent_record(uuid,text,text,text[],text,timestamptz) | current owner/admin/editor membership | unchanged |

assert_ws first requires auth.uid(), then accepts creator, recorded owner or a
membership of any role. Therefore wrapper anon grants alone are not an anonymous
read bypass. The concrete issue is viewer mutation. The existing consent writer
provides a nearby established owner/admin/editor capability rule.

Legacy creator/owner fallback needs explicit treatment: safest preservation allows
recorded legacy ownership only without an explicit lower member role; explicit
viewer membership must win over historical creator identity. No shared assert_ws
rewrite is proposed because other callers may depend on read access.

## Repository caller inventory

Searches across assets, api, mobile, supabase/functions found no runtime calls to
asset_list/save/delete. Audience calls occur only in assets/suite/audience.js:
list, upsert, delete, import, plus already role-checked email_consent_record. CSV
export is local Blob construction from already-readable contacts.

Suite passes ctx.role with the current selected workspace. Audience ignores it;
add/import and edit/delete controls are rendered for all users. Audience currently
has no auth-change teardown or delayed-response identity fence. A delayed private
contact response could render after the signed-in actor changes; this adjacent
privacy concern belongs in the same client patch, without expanding into a new
CRM feature build.

## Proposed ownership and acceptance

Await root scope agreement before implementation. Proposed files:

- One CLI-created migration with a private exact mutation authorization helper,
  replacements of the five existing writer bodies preserving signatures/behavior,
  and authoritative capability response for the audience editor.
- assets/suite/audience.js for viewer read-only controls, server capability load,
  permission errors and actor/workspace/load cleanup.
- Dedicated tests/database/audience-assets-roles.integration.mjs.
- tests/browser/audience-roles/ fixture and verification with actual suite CSS.
- This audit.

Database checks must use synthetic actors and rows in local PostgreSQL: owner,
admin, editor succeed; viewer read succeeds while each of five writes rejects;
unrelated/anonymous denied; IDs belonging to other workspace cannot mutate;
explicit viewer cannot exploit creator fallback; supported legacy ownership is
covered deliberately; consent parity preserved. Migration privilege/helper grants
are checked independently.

Actual-module controlled browser checks at390/1440: viewer sees contacts and
search/export but no mutation actions; editor completes each allowed action;
permission downgrade is handled without displaying success; delayed reads after
account/workspace switch cannot display private rows; disposal closes modal and
clears contact state. Source/rendered/exercised evidence remain distinct from
production authenticated writes.

## Implemented candidate and local evidence

Root approved the proposed ownership. Candidate migration is
`supabase/migrations/20261001030747_audience_asset_writer_roles.sql`.
`zoi.assert_ws` and read RPC definitions are unchanged. The five writers use a
private exact capability helper. Explicit member role overrides recorded legacy
ownership; only absent membership permits recorded creator/owner fallback.
`audience_access` reports authoritative write capability and separate marketing
consent capability (legacy-only owners cannot gain consent rights indirectly).
The new RPC avoids trusting stale shell role and preserves existing legacy access.

Writer authorization locks workspace FOR UPDATE and an existing member row FOR
SHARE. Metadata confirmed workspace_members has a foreign key to workspaces;
this stronger parent lock also serializes insertion into previously absent
membership. Tests synchronize on PostgreSQL wait events: viewer inserted first
causes a waiting mutation to reject; mutation first completes before viewer
insertion, and the subsequent mutation rejects. This intentionally serializes
these short mutations per workspace; no network work happens inside the lock.

`node tests/database/audience-assets-roles.integration.mjs` passed 12 checks in
a disposable local PostgreSQL16 cluster with synthetic data. Coverage includes
five writes for owner/admin/editor, viewer reads, all five viewer denials, explicit
viewer overriding owner fallback, unrelated/anon denial, cross-workspace IDs,
legacy authority removal, role downgrade, concurrent insertion in both orders and
private helper/capability grants. Existing read wrappers are modeled minimally
in the fixture because no read definition is changed by this migration.

`node tests/browser/audience-roles/verify.cjs` passed 390/1440 with actual audience.js,
actual shared theme and suite container CSS, controlled RPC responses. Viewer
read/search/export remain accessible; add/import/edit/delete and consent controls
are not available. Editor add/edit/delete/import were exercised. Permission denial
clears the form and private list; account change removes imported private drafts
and delayed replies cannot repopulate either old account or old workspace.
Delete/import success now requires the existing server's actual boolean/added+
skipped receipt shape instead of reporting requested counts as completed work.

Styled captures `/tmp/audience-viewer-390.png` and `/tmp/audience-editor-1440.png`
were inspected. The existing mobile table scrolls horizontally inside its own
container; the document has no horizontal overflow. This patch preserves the
existing table design, not a complete CRM redesign. Fonts use the system fallback
because external fixture traffic is blocked. No production customer writes or
schema application occurred. Independent SQL review is pending final readiness.
