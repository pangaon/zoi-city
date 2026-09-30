# Enterprise owner journey audit — 30 September 2026

Scope: workspace onboarding → existing listing claim or private intake → edit → preview → publish → public read, and integration connection. Read-only audit of the integration candidate and public deployed entry points. This is not authenticated end-to-end acceptance. No customer messages, claims, saves, publications or provider authorizations were performed.

## Three release blockers

### P1 — Website-first intake stops before the promised managed onboarding outcome

**Source evidence:** `assets/intake/app.mjs` creates a private draft through `intake_create_draft`; its success message explicitly says website extraction has not run. Existing matches link to `/explore/?q=<name>` in another tab to request a claim. A new owner with no workspace must open `/social/` in another tab, create one, return and reload access. `social/index.html:210–233` workspace creation accepts a business name only. `assets/suite/bizpage.js:498–533` sends an owner without a claimed listing back to `/explore`, without preserving an intended listing or search. The intake migration `20260930105920_private_url_intake_workspace_drafts.sql:77–83` deliberately creates hidden, unverified, unclaimed drafts with extraction status `not_requested`.

**Rendered evidence:** Live `https://www.zoi.city/add/` at 390px displays the correct private-draft limitation, including “Website extraction is not yet available in this flow.” Live `/social/` displays email-code sign-in. Both entry pages fit 390px with document width 390px. No sign-in email sent.

**Journey status:** Partial. Duplicate website lookup and secure private draft creation exist; this is not a URL → enriched draft → review → submitted/published business journey. A customer must manually re-enter business details and move between entry points. Claim review may legitimately need human verification, but its handoff should retain context and expose progress.

**Responsible modules:** `assets/intake/app.mjs`, `assets/intake/model.mjs`, `social/index.html`, `assets/suite/bizpage.js`, Explore's existing claim chooser and the intake/claim RPCs.

**Concrete fix:** One resumable onboarding record carrying URL, exact candidate listing, chosen workspace and next required action. Route existing matches directly into the existing workspace claim chooser. Reuse the enrichment pipeline as a durable private-draft job with source evidence and owner review; never turn import completion into ownership verification. Add a visible review/submission status and explicit publication boundary rather than calling a saved draft finished.

**Acceptance required:** New owner/no workspace; existing owner/two workspaces; website shared by branches; duplicate match; pending claim; failed extraction/retry; logout/account change; reload mid-flow. Check no duplicate listing or cross-workspace disclosure.

### P1 — Design preview and canonical renderers diverge, blocking publication for omitted families

**Source evidence:** `api/entity.js:528` includes `renderHospitalityHome` and `renderSocietyHome` before the other family renderers. `api/home-preview.js:28–29` omits both and returns HTTP 409 `home_preview_not_supported` when none of its renderers accept the entity. Hospitality eligibility is explicitly hotel/resort/guesthouse/accommodation categories in `api/_hospitality-home.js:5`. These are not professional entities: `professionalContent` requires professional eligibility. `assets/homes/editor.mjs:58` refuses publication unless the saved draft has successfully previewed. Thus a hotel owner can have a canonical family home while lacking its required private preview/publication path. School/other generic-family eligibility needs a separate matrix; absence of an import alone is not evidence every such family fails.

**Rendered evidence:** Code-level renderer mismatch established. No authenticated hotel preview session exercised during this audit. The anticipated 409 is a source-proven branch, not a claimed production HTTP reproduction.

**Journey status:** Blocked for the omitted hospitality family when using the design editor. Society additionally needs design-aware rendering, not merely adding an import to a renderer that ignores design arguments.

**Responsible modules:** `api/home-preview.js`, `api/entity.js`, family renderers, `assets/homes/editor.mjs`.

**Concrete fix:** Reuse one family renderer registry for canonical and authenticated private preview, including identical effective owner content and design. Give unsupported families an explicit supported draft/publish contract; do not bypass the faithful-preview gate to hide missing rendering.

**Acceptance required:** Populated and sparse hotel, restaurant, professional, church, creator, school/organization and generic record; saved draft → exact private preview → publication receipt → fresh canonical read. Verify private data stays private, explicit owner clears survive, and ownership transfer invalidates stale operations.

### P1 — Social publishing integrations are not operational for any owner

**Live source evidence:** Fresh unauthenticated GET on `https://csebihpaychdkanjjsmz.supabase.co/functions/v1/social-config` returned all six advertised social platforms unavailable: Facebook, Instagram, LinkedIn, TikTok, X and YouTube. Services also reported `email:false`, `ai:false`, `stripe:false`, `payments:false`. The email flag is the suite service flag; this audit does not infer that authentication OTP delivery is disabled.

**UI code evidence:** `assets/suite/connect.js:355–363` correctly disables Connect when `providerReady` is false and explains that Zoi needs a provider developer application. Ready platforms use existing `social-connect` authorization with the workspace and current actor. Planning handles are stored separately and correctly do not represent publishing authorization. Connected accounts at line 350 currently require support to disconnect.

**Journey status:** Blocked before provider authorization on current configuration. No actual connected-provider render or publish attempt performed. Truthful disabled buttons are preferable to false success, but are not an operational customer offering.

**Responsible modules:** `assets/suite/connect.js`, `assets/suite/capabilities.mjs`, deployed `social-config` and `social-connect`, provider application configuration and token lifecycle services.

**Concrete fix:** Activate a bounded provider with approved application credentials/redirects and tested grant scopes, then verify connection → publish → durable provider receipt → revoke/reconnect. Add self-service disconnect/revocation with workspace authorization and clear effect on queued posts. Keep unsupported providers visibly unavailable; offer an actual export/share journey while they remain unconnected.

**Acceptance required:** Provider denial, expired/revoked access, wrong account/page, multi-workspace account, reconnect, duplicate publish retry, rate-limit/backoff, asset rejection, permission changes, partial multi-channel success, owner removal. Browser OAuth must never expose stored secrets.

## Additional material gaps and safeguards

- **P2: Content preview is not a full publication review.** `assets/suite/bizpage.js:570–578` explicitly saves profile content publicly while design remains private. Its “Live preview” around lines 766–815 previews main details and sends users to the public page for the full layout. `home_content_save` has version/nonce receipt validation and uncertain-response handling around lines 907–939; preserve these. If the intended journey is full-content review before publish, it needs staged content and a combined effective-content preview, not renamed buttons. Authenticated save→public-current-data was not exercised in this audit.
- **P2: No self-service provider disconnect.** Confirmed UI copy requires contacting support. This creates an operational ownership/offboarding dependency even after providers become available.
- **P2: Claim context is lost at module boundaries.** The new explicit Explore workspace chooser fixes silent first-workspace selection in the candidate. It does not by itself connect onboarding, listing identity and workspace selection across intake/social/bizpage. Reuse it rather than creating a parallel claim writer.
- **Existing strengths:** Private intake uses actor-scoped pending receipts and account-change clearing; a draft is not represented as a verified claim. Content save validates listing/workspace/request/version receipt. Design preview is inert and private by design. Disabled integrations are accurately labeled. These safeguards should remain intact while journeys become complete.

## Evidence ledger and limits

- Public production rendered: `/social/` and `/add/`, signed out, 390px; no horizontal overflow. Semantic email and website fields and their primary actions visible. Desktop authenticated dialogs, keyboard submission and OTP delivery not tested.
- Live capability response: all social providers unavailable, recorded above.
- Source reviewed: named intake, workspace, business editor, design preview/canonical renderers and connect modules in `.recovery/community-release`.
- Authenticated owner claim→edit→publish→public read: **not verified**, no current authorized owner fixture used.
- Native iOS/Android parity: **not verified**; responsive browser layout is not native implementation evidence.
- No code or configuration changed by this audit. These findings are actionable blockers and follow-up acceptance criteria, not a statement that the owner suite is complete or insecure overall.
