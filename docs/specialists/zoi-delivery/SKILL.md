---
name: zoi-delivery
description: Implement and review Zoi business homes, category editions, owner tools, Community and native journeys against the user's source-specific design and operational requirements. Use for Zoi delivery work, not unrelated projects.
---

# Deliver a complete Zoi experience

Zoi is the Greek community and business operating platform. A business home must
present and operate the client's actual offering, with useful customer journeys
and manageable owner tools. Public content must not look like an internal audit.

Read the applicable [specialist role](references/roles.md). Preserve the full
requested scope in `docs/recovery-scope.json`; an incoming example steers existing
work rather than replacing it. Keep unsupported and untested capabilities open.

## Product and design decisions

- Use the client's visually checked identity, real photographs and appropriate
  palette. Preserve Zoi navigation and usability while giving each home distinct
  art direction. Do not transplant another client's photos or facts. Publisher
  alt text, a filename containing "logo", or a society affiliation is not visual
  identity evidence. Use the user's exact Zoi logo when available; don't invent it.
- Offer the four existing owner-selectable designs where implemented; restaurants
  default to Concierge. The ordinary canonical listing route must use the family
  design. A hardcoded showcase ID must not exclude the rest of that family.
- Give heroes intentional crop, legible typography and image attribution where
  useful. Use depth, rounded geometry, glass and motion deliberately. Check dark
  and light modes, reduced motion, slow loading, absent imagery and long names.
- Forms need compact hierarchy, aligned controls and labels, readable text,
  useful defaults and clear next actions. Inspect every opened dialog, picker,
  validation message and result—not only the first screen. Avoid huge empty
  sections, detached checkboxes, clipped controls and floating overlays that
  obstruct navigation or the mobile keyboard.
- Keep technical collection/review language in appropriate details or owner
  tools. Public copy should explain the offering and next action. Preserve the
  material distinction between an enquiry, private draft and confirmed booking.

## Facts, integrations and editing

- Compare the original source with the data returned by the public API and the
  actual rendered home. Detect missing projection fields as well as extraction
  failures. Record source date, exact identity and unavailable information.
- Reuse existing suites and writers. Owner edits and explicit clears override
  imports and curated defaults. Test edit → preview → publish → public read,
  authorization, ownership transfer, stale versions, lost responses and account
  changes. Menus, prices, promotions, hours and offerings need real editable fields.
- URLs, embeds, OAuth accounts, analytics and publishing are different states.
  Only advertise the state actually connected. Provider setup must have a working
  owner path and customer fallback. Appointment slots are not hotel/rental stock.
- Canonical links come from current record identity; stale stored paths must not
  strand visitors. Geography distinguishes city, region, country and worldwide.
  Sponsorship requires approved, active, correctly scoped inventory and disclosure.
- The same product capability must be assessed for web, iOS and Android. Record
  native implementation, deliberate web handoff and unsupported behavior honestly.

## Evidence before handoff

Use the deployed versioned master and per-listing criteria (`listing_quality_checklist`).
Source presence, renderer output and completed user journeys are separate evidence.
Specialist and independent reviewer use distinct artifacts. A changed source,
owner edit or criterion revision requires rechecking affected evidence.

For a shared correction, identify its affected families and test a populated home,
a sparse home and relevant edge cases. Check 390px and desktop; open the actual
forms, menus, player, gallery and action results. Exercise keyboard/focus, loading,
empty/error/retry states and current record links. Run relevant lint/tests and the
exact staged release checks. Verify the production deployment before saying live.

Avoid waste: do not build per-record copies, repeatedly buy builds or call paid AI
for deterministic checks. Batch a coherent release and preserve evidence. Maintain
an explicit remaining-work list; never convert an untested item into a pass.
