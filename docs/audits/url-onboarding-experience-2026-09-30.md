# Guided website onboarding — implementation brief

Date: 2026-09-30. Status: specification, not a claim of deployed functionality.
Implementation owner: `production_recovery`. Experience review: `creator_suite`.

## What this release should accomplish

A signed-in operator pastes a website, checks possible existing homes, confirms
which business or branch they represent, and creates one recoverable private draft
in an authorized workspace. They can then edit that draft using existing owner
tools. Website submission is neither ownership verification nor publication.

Evidence reviewed: `add/index.html` and
`supabase/migrations/0038_self_serve_intake.sql`. The legacy flow picks the first
registrable-domain match, creates an unassigned draft, polls a legacy enrichment
shape, and sends confirmation to the generic suite. Its suggestion that the crawler
will keep trying is not a dependable job receipt: the current public enrichment
queue excludes drafts. Do not carry these promises into the replacement.

## Journey and exact states

| Step | Screen and action | Completion condition |
| --- | --- | --- |
| 1. Your website | One labeled URL field, example, **Find my business**. Preserve text through validation and sign-in. | URL passes existing server URL/SSRF rules; lookup responds. |
| 2. Is your business already here? | Up to a bounded set of public matches: name, city/country, address when known, canonical home link. **This is mine** or **A different branch/business**. | User explicitly selects an identity or chooses a new draft. |
| 3. Your draft | Choose an authorized workspace, confirm name, entity type, compatible category and location. Keep the entered branch URL. | Required fields valid; no unconfirmed category guess; owner/admin workspace permission checked server-side. |
| 4. Create private draft | Review a compact summary and **Create private draft**. Show one pending action. | Exact idempotent server receipt identifies this request, actor/workspace and newly created listing. |
| 5. Make it yours | **Edit this draft** opens its actual owner editor. Explain it remains private. Show supported next steps: contact, photos, services/menu, design and preview. | Exact draft selected in authorized workspace, not merely arrival at suite homepage. |
| 6. Review and publish | Existing authorization and publication workflow only. Show actual missing requirements and review state. | Server confirms publication and public read returns the same listing; otherwise say draft or pending review. |

Proposed implementation contracts supplied by the implementing specialist:
`intake_lookup`, `intake_options`, `intake_create_draft` and
`intake_draft_receipt`. `intake_create_draft` accepts a stable request UUID,
workspace, website, name, type, category, city and country. Legacy `intake_submit`
should direct callers into the safe workflow, not create orphan drafts.
These names describe the agreed candidate; implementation/tests determine final
argument and response shapes.

## Identity, ownership and suggested data

- A shared domain is a **possible match**, never proof of duplicate identity.
  Chain branches, people in society directories and organizations sharing a host
  need explicit name/location confirmation. Never silently select the first row.
  Exact-record claiming must use the real claim process. Public lookup must not
  reveal hidden/draft rows or their owners, even when preventing duplicates.
- Creating a workspace draft grants draft-editing permission, not proof that the
  person owns the external business or domain. Keep verification separate. Route
  existing homes to the supported ownership-proof workflow; if proof is not
  implemented for a case, show its actual support/review state, not a verified badge.
- Category and type suggestions must be labeled **Suggested** and confirmed.
  Prefer existing compatible category options; allow correction before creation.
  A domain suffix or business name alone does not establish profession or credentials.
- This bounded release does not automatically extract private-draft websites.
  Say **Add your details** rather than “we found” or “your website is imported.”
  Later extraction must show each field’s source URL, checked date and whether it
  was imported, owner supplied or unavailable—no invented confidence percentages.
  Owners can correct and explicitly clear imported values. Reimports never replace
  an owner edit or resurrect a deliberate clear.

## Errors, retries and resume

Keep a visible step label and inline status, with focus moved to the first invalid
field or error summary. Avoid spinner-only waiting and automatic navigation.

Lookup is a read: debounce only if introduced with stale-response fences; explicit
submit remains usable. A failed lookup is **Could not check for existing homes**,
not **No matches**. Preserve URL and provide retry. Login/workspace/category errors
must leave the draft form intact without implying it was saved.

Before draft creation, persist the request UUID and the account/workspace scope
needed for recovery. Send an immutable snapshot. Disable duplicate submission.
On timeout, disconnected network, malformed receipt or unknown server outcome,
show **Checking whether your draft was created** and recover through
`intake_draft_receipt`; retry only the exact original request where supported.
Never generate a new request or allow “discard and create again” while uncertain.
Distinguish a confirmed not-created/validation refusal from an unknown outcome.
On reload, recover the scoped receipt before offering another creation. Do not
persist authentication tokens or sensitive business details in an onboarding marker.
Account/workspace change clears private UI immediately and fences delayed results;
one account cannot recover or display another account’s draft.

## Native and acceptance checklist

Until a native equivalent is implemented and tested, expose an explicit **Continue
on Zoi web** handoff to `/add/`; explain browser sign-in may be required. Do not
forward tokens or assert that native creation/import is supported. Return links
must be canonical and safe; no legacy `/p/` assumptions.

- [ ] Same-domain branches remain selectable as distinct businesses; no silent merge.
- [ ] Existing public match opens its current canonical home and genuine claim path.
- [ ] Hidden matches are not disclosed; duplicate refusal does not leak private data.
- [ ] Workspace viewer/outsider cannot create; owner/admin permission is rechecked.
- [ ] Type/category mismatch and invalid URLs receive actionable errors.
- [ ] Double click, lost receipt and reload resolve to one exact private draft.
- [ ] Account switch during lookup/create/recovery cannot expose stale private state.
- [ ] Created draft is hidden/unverified and excluded from public home/search APIs.
- [ ] Edit link selects the exact draft; edit → reread → preview is exercised.
- [ ] No extraction, proof, publication or retry-job success is claimed without evidence.
- [ ] 390px and desktop: keyboard, loading, empty/error, long branch names and no-workspace states.
- [ ] Native handoff tested separately from web creation; report deployed/source-only status.
