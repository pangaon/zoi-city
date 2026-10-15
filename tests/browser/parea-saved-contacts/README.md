Actual current host guest/roster with controlled authenticated readers and phone
API. It does not use customer contacts, real Auth, OS permission or a provider.

```sh
NODE_PATH=/path/to/existing/node_modules \
CHROMIUM_EXECUTABLE_PATH=/path/to/chrome \
ZOI_PAREA_CONTACT_BROWSER=/tmp/independent-parea-contacts \
node tests/browser/parea-saved-contacts/verify.cjs
ZOI_PAREA_CONTACT_EVIDENCE=/tmp/independent-parea-pg \
node tests/database/parea-contact-journey.integration.mjs
node --test tests/unit/guest-contacts.test.mjs tests/unit/contact-picker.test.mjs \
  tests/unit/workspace-contacts.test.mjs tests/unit/parea-roster-plan.test.mjs \
  tests/unit/invitation-share.test.mjs
```

The database command creates and removes its own PostgreSQL16 cluster on port
15763 (PGPORT overrides), self-signed local TLS fixture and synthetic contacts.
It installs the retained canonical event suite/current-session authority, then
pins actual captured audience_access/list and canonical guest save/get bodies
against live pg_proc metadata. The one Auth-profile identity boundary is a fixed
local fixture, not an Auth issuer, bypass or real sign-in proof. Actual current
session/role helpers run for the canonical readers and guest writer.

Its mounted390/1440 journey searches two distinct same-name Audience people
beyond the initial500, selects one, edits/reviews the guest label/quantity, saves
via existing event_host_guest_save, intentionally loses the committed response,
checks the original receipt, reads the persisted guest and reopens it in a fresh
browser page. Contacts' complete row fingerprint stays unchanged; no contact,
consent or provider writer is permitted. Contact UUIDs/channels are not guest
metadata or Auth identities. No message, payment or admission ticket is created.

21 controlled browser cases additionally exercise exact reader workspace,
explicit server search/keyboard use, duplicate people, quantity/review retention,
roster guest-only edits, wrongscope/error/retry/sparse/current role/contact changes,
long names, held account/session/source/removal responses, names-only direct phone
gesture+review/cancel/denial, no-workspace phone and unsupported manual fallback.
Browser route denies all nonlocalhost requests. The OS phone permission prompt
is simulated and requires later actual-device acceptance.

Guest and roster sources stay separate: Audience people, Work relationships and
phone contacts are never merged or copied into another contact store. Reading is
only on explicit source/search; current access is checked again before selection.
Changing the guest label never edits its shared contact. Shared contact editing
remains in the existing Contacts tools under their existing writer permissions.

Primary Audience reuse requires this host page's explicit authorized workspace.
No-workspace links have phone/manual choices. This does not enumerate another
workspace, connect the separate customer-a personal planner or claim all saved
contacts are unified. Audience reader is capped500; displayed choices are capped30
with search guidance. Names over80 or containing control characters require an
explicit shorter single-line guest label rather than a silent stored truncation.

Existing workspace-contact browser fixtures retain all assertions. Their only
fixture updates add a valid synthetic JWT session_id and scope ambiguous selectors
to the guest form because current host also contains a separate roster form.
