# URL onboarding repair — candidate, 2026-09-30

## What actually works in this candidate

A signed-out visitor can enter a bare domain, sign in on the same page, and retain the website. Signed-in owners/admins see public same-host candidates, including distinct branches, then explicitly enter a name, type, category and location for a private draft. Typed details update the preview immediately. Loading indicators reflect actual workspace lookup, public match lookup and draft-save requests only.

The saved draft is hidden, unverified and unclaimed, scoped to the chosen workspace. It does not prove ownership of the external business. An exact workspace/listing link opens the existing business editor, whose choices are independently authorized. The existing writer supports details/design; publication still requires review. This is not autonomous source extraction or a complete AI website builder.

## Backend controls

CLI-created migration `20260930105920_private_url_intake_workspace_drafts.sql` adds private actor/request receipts and five authenticated functions: `intake_options`, `intake_lookup`, `intake_create_draft`, `intake_draft_receipt`, and a safe replacement of legacy `intake_submit`. Legacy calls no longer write orphan drafts or disclose private same-domain names/slugs.

Lookup only returns published clean/cleared nonhidden records. Host comparisons retain path case for exact-URL matching; a shared host never automatically claims one branch. Draft creation locks actor and URL/name/location identity, limits five new drafts and20 nonce receipts/day, reuses an exact same-workspace private draft, and rejects incompatible classification reuse. Payload hashes prevent changed-nonce replay. Current owner/admin membership and listing ownership are rechecked on save/recovery. No public queue or SSRF restriction was relaxed. Category existence is validated; automatic semantic category/type classification remains open.

Only a nonce and workspace ID are stored in session storage. A lost response retains the same request and recovery retrieves its private actor-bound receipt. Account changes clear the previous workspace UI and reject stale responses. Existing authentication is reused; no secret or session is written to reports.

## Evidence

Primary isolated PostgreSQL runner: `tests/database/url-intake.integration.mjs`, eight passing groups: URL/auth validation, public-only branch choices, legacy no-write behavior, private draft/idempotency, changed classification refusal, daily draft/receipt limits, actor/membership/ownership fences, grants. Independent QA additionally proved real concurrent same nonce creates one draft/receipt, two actors in one workspace reuse one draft, and a malicious publication trigger rolls the transaction back. No production mutation by this specialist.

Four focused unit checks cover URL normalization, strict receipt status/scope, metadata-only pending storage isolation and actual authorized editor choice logic. Browser fixture acceptance at390/1440 used mocked API responses, explicitly not production writes: live typed preview, uncertain save after simulated commit, nonce recovery, exact editor link, and account switch while a lookup was pending. Actual signed-out UI preserves `avli.de` and does not send an email until the visitor submits the email form. No horizontal overflow at390.

Screenshots: `.recovery/logs/intake-draft-preview-390.png`, `intake-draft-preview-1440.png`, `intake-guest-dark-390.png`. Production rollback fixture: `ops/verify-private-url-intake.sql`, dedicated QA workspace only, final ROLLBACK.

## Product patterns researched

[Wix Aria](https://support.wix.com/en/article/wix-harmony-editor-working-with-aria) keeps design assistance inside the editor. [Framer’s AI canvas](https://www.framer.com/ai/) produces editable website layers. [Lovable Visual Edits](https://lovable.dev/blog/visual-edits) lets users select and alter actual page elements with preview updates. Their useful common pattern is a continuously editable result. Here the bounded implementation provides an honest typed preview and existing editor handoff, not a simulated source-build animation or claimed integration with those products.

## Remaining gaps

Private URL extraction requires its own authorized, bounded source job contract; the public enrichment queue intentionally excludes drafts. Automatic category inference, publication review/ownership proof, comprehensive editing of every identity field and native URL intake are not completed. Native has existing owner editing/web handoff but no matching native intake workflow. Legacy claim autoapproval/role/concurrency warrants a separate review; this patch does not rewrite claims.
