# Contacts to parea — retained-contract audit

The actual workspace Contacts tool is the contact edition of `assets/suite/operations.js`, backed by `ops_records_list` and existing versioned Operations writers. Its records are CRM records, not authenticated profile identities. Contact IDs must never be substituted for a table host's account reference.

The actual `assets/tickets/host-allocations.mjs` add-guest form currently offers only manual label and whole-ticket quantity. The 390/1440 existing `tests/browser/host-allocation-drafts/verify.cjs` journey passes review/back-to-edit, role denial/account clearing and zero writes, but contains no saved-contact selection. `mountInvitationShare` offers phone/manual contacts only after saving the guest allocation, for user-reviewed external message composition. This leaves existing workspace contacts disconnected from guest-name entry.

Proposed smallest reuse: an explicitly opened workspace contact search in the guest form, using existing `ops_records_list(p_workspace, p_kind='contact', p_include_archived=false)` once per open, followed by local filtering. Validate role, exact workspace on every record, contact kind and archive exclusion; never infer an Auth identity. Selected name fills the existing editable draft and leaves ticket quantity unchanged. Existing review/CAS/receipt writer remains authoritative. Account/event/workspace changes, revoked access and removed surfaces clear the private picker; refresh occurs before the final scope check and RPC dispatch.

Guest hosts without an explicit authorized workspace retain manual entry. No broad workspace enumeration or first-workspace fallback. CRM email/phone must not be persisted into ticket metadata or automatically messaged. Server email/SMS delivery is not configured by this change; existing external mailto/sms links still require the user's own review/send action. A saved or accepted allocation is neither collected payment nor admission ticket.

No production SQL polling or mutation performed. Implementation ownership requested separately; existing service-family and native packets remain frozen.

## Implemented local candidate

Approved narrow implementation now adds `workspace-picker.mjs` and a guest-form mount/disposal in host allocations. It uses the existing Contacts reader, only on explicit open/reload. Results are filtered locally; up to 30 matching choices appear with a refine-search hint. Names over the existing 80-character guest label limit require manual editing rather than silent truncation. No email/phone is displayed or retained in the picker projection. No CRM ID is sent to the guest writer.

The picker permanently invalidates on actor, event/query, workspace callback or owned-root loss, checks queued removals synchronously, clears retained detached DOM, and checks scope after refresh before auth:prefer dispatch. Reload clears old results before waiting. Host render/disposal destroys the picker; all existing allocation writers and quantity validation remain unchanged.

Evidence: new actual-host controlled browser fixture `tests/browser/workspace-contact-host/verify.cjs` passes at390/1440: keyboard search/ArrowDown/Enter choice, quantity3 preserved through review/back, zero writes from selection, wrongscope failure, retry, empty search, refresh/account switch zero private dispatch, held response/account switch and removed/reattached picker cleanup. Existing host-allocation-drafts390/1440 passes unchanged. Two unit groups verify projection and malformed/wrongscope/archive/role rejection. Phone screenshot `/tmp/zoi-workspace-contact-390.png` visually inspected: readable search and choices, no clipping. These are controlled API journeys, not production contacts or delivery tests.

No schema, message dispatch, live contacts mutation, stage or deploy performed. Reader still returns all permitted contact rows before local filtering; this is inherited existing API behavior, not server-paginated autocomplete. Native phone contact picker and server transport/provider readiness are unchanged.
