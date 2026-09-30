# Follow and listing review security candidate

2026-09-30. No production mutation or deployment. Live function definitions and table columns/constraints were inspected for the three legacy writers and listing review reader. Existing public functions admitted anonymous writes, supplied arbitrary profile IDs, and immediately classified caller-authored reviews as clean. See the independent caller inventory `follow-reviews-sitewide-2026-09-30.md`.

## Candidate contract

`20260930122910_follow_review_actor_fences.sql` keeps existing signatures/return types. Anonymous/PUBLIC write execute is revoked. Every write additionally requires `auth.uid()`; follow/unfollow requires the supplied profile UUID to equal `zoi.ensure_profile()` for that signed-in user.

Follow accepts the existing six relation values, rejecting unknown values. The listing must be published, clean/cleared and not marketplace-hidden; it is locked for the write. Same relation retries remain idempotent. Unfollow removes only the actor's own `follow` relation, including from a now-hidden listing; `my_church`, `my_org`, `attend` and other affiliation relations are preserved. Its generic success reveals no hidden listing identity or existence and allows privacy withdrawal.

Review submissions require rating1–5 and authored text1–2000 characters; overlong text is rejected instead of silently truncated. Direct owners and any member of the owning workspace cannot review that listing. `author_user_id` stores the authenticated user UUID; `author_name` derives from their actual profile display name. The old `p_author` argument remains accepted for wire compatibility but is ignored. No account ownership is inferred from a client profile UUID.

An actor-level transaction lock serializes duplicate submissions and the ten-new-reviews/24-hour bound. Existing actor/listing reviews are not overwritten. Exact content retry returns `pending` while under review, otherwise `already_submitted`; a different duplicate returns `review_exists`. There is no new nonce contract or edit/delete UI in this containment.

New reviews have `moderation_status='under_review'` and return **`pending`**, never `ok` or a publication claim. Rating/rating_count are not changed. Existing historical reviews and aggregates are untouched. Public `zoi_listing_reviews` retains its JSON shape but requires a public parent and a clean/cleared review. Rows sort by the raw timestamp and stable UUID, not the formatted date label; internal sort keys are not projected. No new approval endpoint is created; an operational approval workflow remains a separate gap.

Other returned text errors: `not_signed_in`, `not found`, `bad rating`, `invalid_body`, `self_review_not_allowed`, `rate_limited`. Follow JSON retains `ok`/`error` and success slug/relation. Invalid profile/relation and private listing responses contain no private fields.

## Caller and operational limits

The bounded source search finds legacy follow calls in `explore/app/index.html`, but actual browser navigation confirms line7 immediately redirects this route to `/explore`; these controls are not currently reachable as a public Follow experience. This candidate repairs that caller: authenticated `authRPC`, fresh `zoi_me.profile.id`, matching successful receipt before UI/cache changes, generic Follow/Following, account-scoped confirmed cache, stale-account response rejection, immediate visible-control repaint on account changes and sign-in before writes. Legacy global optimistic entries are not imported or silently submitted. The read caller now sends `p_slug` correctly. Auth failures only clear the session that made that request. Existing affiliations remain untouched; this generic toggle does not claim church membership or attendance. Other legacy onboarding/profile readers remain outside scope. The review action currently says coming soon; no active canonical or native review writer was found. This backend containment does not claim to complete those interfaces.

No historical anonymous reviews are assigned invented owners or reclassified. Existing duplicate historical rows are not deleted; deduplication applies to new actor-bound calls. No inference of verified purchase/attendance is made. Existing table policies, other profile read endpoints, moderator operational workflow and review appeals remain outside this narrow review. Direct DML permissions must not be assumed safe from function-only tests.

## Validation

`node tests/database/follow-review-safety.integration.mjs`: nine real PostgreSQL16 groups pass: anonymous/forged actors; idempotent follow and private withdrawal; listing visibility; rating/body/self-review; concurrent duplicate→one pending row with actual author and unchanged aggregate; moderated-only public reads and hidden-parent suppression; chronological ordering with unchanged projection; daily actor limit and revoked anonymous grants; exact dedicated-QA rollback fixture with unchanged listing/review/follow/audit counts.

Tests use isolated synthetic fixtures with the live review status CHECK values and distinct auth/profile UUIDs. No production follow or review was written. Root review and production rollback verification remain pending.

## Production compatibility read (no mutation)

A fresh metadata read confirmed all four live signatures/return types match the candidate, all are SECURITY DEFINER, and anonymous execute remains enabled before deployment. Reviewed columns include the existing nullable UUID review author_user_id, UUID listing owner fields, profile auth UUID/display name and text audit fields. Existing review moderation CHECK permits under_review, rating CHECK permits1–5, and user_places has the required unique(profile_id,listing_id,relation) constraint. Audit log has no action-enum CHECK conflicting with review_submitted. No credential or customer row was queried.

`ops/verify-follow-review-safety.sql` pins the dedicated QA auth/profile/workspace, uses BEGIN/ROLLBACK, creates an uncommitted isolated listing only, and verifies actor guards, follow-only withdrawal, pending/idempotent review, unchanged aggregate and hidden-parent suppression. It never commits a public fixture. Production execution remains root-owned after migration review.

`node --test tests/unit/explore-follow-safety.test.mjs`: seven tests pass against extracted actual inline code, including authenticated profile use, refusal/unknown result, cross-account stale response, sign-in gate, exact review argument and all-inline-script syntax. These checks include connected-control repaint on account changes and detached-view pruning. Browser acceptance separately exercised the exact legacy component in a local fixture with only the redirect removed: signed-out Follow opened the real email sign-in sheet, left zero confirmed follows and retained Follow wording. Screenshot `.recovery/logs/follow-legacy-component-auth-390.png`. No email submission or authenticated write occurred. This is isolated component evidence, not a live canonical Follow journey. Current `/explore` still needs an explicitly wired Follow experience.
