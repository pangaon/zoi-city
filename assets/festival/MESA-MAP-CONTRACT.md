# MESA canonical festival maps

Source implementation candidate. No migration application, production operation,
native installation, safety review, payment or provider integration is implied.
Migration: `20261104183348_mesa_festival_maps.sql`.

## One connected domain

Hosts are current owned/published/nonhidden/moderation-clean `zoi.listings`
records, preserving existing festival event/organization/business host semantics.
Approved `booth` applications and their allocated units
remain in the existing festival domain. MESA never modifies their commercial
terms/status or invents a sale. Legacy `public.events` and floor plans are not used.

The applicant profile and the business owner are different authorities. Only the
application's current profile may propose a business, and only through the
existing current-session `home_content_authorize(workspace,listing)` guard plus
an exact current `listings.owner_workspace_id` match. The organizer explicitly
accepts that association. Business identity/media edits use the existing business
home editor and publication workflow, not a second MESA branding writer.

## Layout

`{schema:1,width_m:1..5000,height_m:1..5000,booths:[]}`.
At most 200 booth objects, each exactly:

`{id:UUID,label:string(1..40),x_m:number,y_m:number,width_m:0.5..100,height_m:0.5..100,rotation:0|90|180|270,application_id:UUID|null}`.

Coordinates are the rectangle's **center**, in metres. Rotation 90/270 swaps its
effective width/height. Reject duplicate IDs and out-of-bounds rectangles. Drafts
may contain overlapping rectangles; publication rejects positive-area collisions
(touching edges permitted). Assignments require approved booth applications in
this event/workspace and cannot exceed allocated application units, even in draft.
Publication additionally requires accepted, currently owned/published businesses.
Use physical booth codes as labels, not manually copied business names.

This is an organizer-supplied measured site plan. It is not satellite imagery,
Google Maps, a survey, accessibility certification or a verified evacuation plan.

## RPCs and response shapes

All writes need authenticated JWT and active current server-validated session.
All functions return `{ok:true,...}` or raise a specific error. No direct table
grants. All new private tables have RLS and revoked anon/authenticated access.

Shared private values:

- `map`: `{version,draft,published_version,published_at,published_layout}` or null.
- `binding`: `{version,state,listing_id,vendor_workspace_id,business}` or null.
  `state` is proposed/accepted/revoked. Binding version is separate from the
  existing application version. Absent binding starts at expected version 0.
- `business`: `{slug,name,logo:string|null,href}` or null. Uses the existing
  anonymous-safe `home_entity` projection, canonical slug/type routing, encoded
  slug, and owner-field presence precedence (explicit logo clears are preserved).
  No arbitrary applicant-supplied identity, private editor fields or contacts.

Organizer owner/admin/editor roles:

- `festival_map_operator(p_workspace uuid,p_event uuid)` →
  `{ok,role,event:{id,name},map,applications,application_count,applications_truncated}`.
  Up to 200 latest approved booth applications:
  `{id,units,status,organisation,version,binding}`. The typed applicant organization
  is private context, never proof of business ownership.
- `festival_map_save(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid,p_layout jsonb)`
  → `{ok,map,request_id}`. Version 0 creates a map; every save increments version.
  A new draft preserves the prior published snapshot.
- `festival_map_publish(p_workspace uuid,p_event uuid,p_expected_version integer,p_request uuid)`
  → `{ok,map,request_id}`. Validates complete geometry/assignments and atomically
  copies the draft to the published snapshot. Increments version; published_version
  equals that new version. No automatic publishing during drag or ordinary save.
- `festival_vendor_review(p_workspace uuid,p_application uuid,p_expected_version integer,p_action text,p_request uuid)`
  → `{ok,application_id,request_id,binding}`. `accept` requires a proposed binding;
  `revoke` removes representation. Both require a current approved booth application
  and current organizer authority. Acceptance rechecks business ownership/publication.

Applicant profile:

- `festival_vendor_businesses(p_application uuid)` →
  `{ok,application_id,version,binding,choices:[{listing_id,workspace_id,name,slug}]}`.
  Choices are bounded to 200 currently owned/published listings in workspaces
  where the applicant currently has owner/admin/editor authority. Closed application
  choices are empty; its owner can still inspect/revoke the binding.
- `festival_vendor_bind(p_application uuid,p_vendor_workspace uuid,p_listing uuid,p_expected_version integer,p_request uuid)`
  → `{ok,application_id,request_id,binding}`. Both IDs set proposes a verified
  association, always requiring fresh organizer acceptance; both null revokes it.
  An own revocation remains possible after application/event closure. One null
  alone is invalid. No pending claim or self-typed business grants access.

Anonymous attendee:

- `festival_map_public(p_event uuid)` → `{ok,available:false}` when the map was
  never published or the event is unpublished, hidden, moderation-ineligible or
  transferred away from the map's owner. Otherwise
  `{ok,available:true,event:{id,name},version,published_at,layout}`.
- Public layout has the same physical fields but each booth's `application_id`
  is **removed** and replaced with `business:null|{slug,name,logo,href}`. It never
  exposes application/profile/workspace IDs, typed organization, contact fields,
  private inquiries, drafts or request/audit records.
- A withdrawn/cancelled application, revoked/proposed binding, unpublished/hidden
  business, business ownership change or allocation inconsistency removes that
  booth's business association at the next public read. Its old manual label is
  replaced by generic `Booth N` to avoid retaining copied brand names. The physical
  layout remains; an unrelated new private draft cannot change it.

## Concurrency, recovery and ownership

Map and binding writes use separate expected versions. Immutable per-profile
request IDs cover the exact operation/payload and return the original receipt
after current authorization is rechecked. Reusing a request with changed input
raises `mesa_request_conflict`. Historical receipts are not current map state:
refresh the operator/vendor read after uncertain responses or success.

Request locks precede per-event advisory locks and domain locks. Multi-listing
operations lock the host/business listing set in ascending UUID order; vendor
writes first preserve the existing home editor's profile-before-listing order.
This also prevents reversed cross-host business bindings from deadlocking.
Organizer writers then lock the current workspace/session and map; assignments share-lock approved application
rows and accepted binding/business identity during publication. Vendor operations
serialize even first binding creation on the application row. This prevents a
second simultaneous expected-version-0 writer from bypassing CAS. Existing
application cancellation/ownership writers cannot interleave with publication's
protected rows. Public reads dynamically revalidate associations.

An event transfer hides the old map and blocks former-owner operations. New-owner
adoption/reset is deliberately unsupported: private prior-owner drafts are not
silently transferred. No map unpublish RPC is included in this milestone; host
visibility and association revocation remain authoritative safeguards.

Errors include `mesa_permission_denied`, `mesa_event_unavailable`,
`mesa_application_not_owned`, `mesa_version_conflict`, `mesa_request_conflict`,
`mesa_approved_booth_required`, `mesa_application_units_exceeded`,
`mesa_business_acceptance_required`, `mesa_business_unavailable`,
`mesa_booth_collision`, `mesa_booth_outside_site`, `mesa_duplicate_booth`,
`mesa_invalid_layout`, `mesa_invalid_booth`, `mesa_map_ownership_changed`.
Preserve edits on errors. Expired/revoked sessions must leave private content and
return to the existing authentication/context flow.

## Acceptance and boundaries

Run `node tests/database/mesa-festival-maps.integration.mjs` using isolated local
PostgreSQL (`PG_BIN` override supported). Its fixture consumes actual current
session/workspace/home authority function bodies from the inspected migrations;
public `home_entity` is an explicitly isolated projection stub. No credentials,
production database, network, email, payment or provider writes are involved.
It checks authorization, geometry, acceptance, CAS/retries, retained publication,
safe projection, cancellation, ownership change and concurrent first bindings.

Web owner/applicant/attendee controls require exercised phone/desktop journeys.
Native first release may deliberately hand off to the web route; that is not
native UI parity, device validation or app distribution evidence. Social video,
map navigation, sponsor artwork, external calendars and commerce keep their own
existing contracts and remain outside this migration.
