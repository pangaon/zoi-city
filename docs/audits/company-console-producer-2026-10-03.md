# Company administration console candidate

The existing Operations suite now opens an organized company console instead of
an empty record editor. All companies returned by the authorized workspace reader
have a company card and a cross-company attention queue. Selecting a company opens
a full-width dashboard with projects, assigned work, overdue and blocked tasks,
search and filters, linked contacts, registration details and private document
records. The existing save, archive, history and interrupted-write recovery
operations remain authoritative. No per-client or country-specific fork was added.

## Implemented and exercised

- Company setup has grouped identity, optional registration and website fields,
  appropriate browser autocomplete, clear labels and cancellation.
- A contact created from a company keeps that company context, can be opened by
  an exact Operations deep link and returns to the same company. Email/telephone
  actions use validated schemes and require a user click.
- Work filters use saved status, assignment and timestamps: all work, attention,
  overdue, next seven days, blocked, unassigned and completed. An overdue completed
  task is excluded from attention; another company’s work is excluded from the
  selected company. Dates are displayed in the device timezone.
- Company details reflect explicit owner clears. Registration values are records,
  not independently verified legal status or inferred filing obligations.
- An explicit export downloads the selected company’s record, projects, tasks,
  contacts and document metadata already checked. Unqueried document metadata is
  `null`, not an invented empty inventory. Document contents are never exported by
  this feature. The downloaded file contains private workspace data by design;
  no private record payload is persisted to browser storage.
- Current account/workspace fences and unknown-write recovery remain in place.
  A committed but lost task save is recovered by its receipt without a new write.
  Viewers have no writer actions or private-document access. Logout removes the
  loaded dashboard and export action.

## Evidence boundaries

The new browser verifier mounts the actual Operations JavaScript with controlled
RPC responses at 390 and 1440 pixels in light and dark modes. Each case exercises
company selection, filters, document metadata, scoped JSON download, contact save
and deep link, assigned task save with a lost response, explicit legal-name clear,
viewer restrictions and logout. Fixture company names and records are fictitious.
Screenshots are local candidates, not production customer data or deployment proof.

The existing full social-shell company verifier separately exercises company edit
→ project → assigned task → interrupted-save recovery → private document upload
and version → back/forward/reload → task/project completion → viewer/logout at
390 and 1440 pixels. Its transport and uploads are controlled fixtures. The
existing Operations recovery verifier also checks remount, transient failure,
denial clearing and a delayed import after account change. Focused unit evidence
covers scope, sparse/malformed data, task filtering and exact contact routes.

An independent specialist has captured the actual installed backend definitions,
ACLs, RLS and migration ledger separately. Real isolated PostgreSQL writer tests
exercise Operations and document transactions. Neither source metadata nor these
fixtures prove a production authenticated customer upload or installed native app.

## Still open

Government formation/filing services, electronic signatures, shareholder records,
employee/contractor administration and jurisdiction-specific obligations are not
delivered by this dashboard. It does not advertise those services as connected.
Existing document readers return a bounded recent set; counts refer to records
returned, not a complete company archive. Native Operations retains its existing
company/project/document journey; these new web filters and JSON export are not
new physical-device acceptance or app distribution.

The independent live definition review found an inherited strict-session and
post-lock authority gap in Operations/document SQL helpers. This UI preserves
existing browser identity fences and backend role/version checks; it does not
claim to fix expired/revoked database sessions or authority changed during a lock
wait. That hardening remains a separate tracked task.

The first recovery run exposed a recovered company’s settings remaining collapsed;
the save receipt now opens its company details for follow-up. The first custom
browser runs also exposed ambiguous exact select labels; explicit accessible
names were added. Failure logs are retained separately from final passes.
