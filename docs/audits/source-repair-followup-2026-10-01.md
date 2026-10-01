# Two official-source follow-ups — 2026-10-01

Read-only source research. No worker dispatch, queue lease, database query/write, profile change or guard relaxation. Existing failures remain historical outcomes; these checks do not assert that the earlier timeout cause is known.

## Melanthi Hotel

Listing `04ae2053-1e91-49b2-bd31-19a5e9158a2a`; current official URL remains https://www.melanthi.gr/ . Current homepage identifies Μελάνθη in Makrinitsa, Pelion, matching the source identity in the listing audit. Its actual rendered homepage shows the branded hotel building, room categories, contact and location links; no challenge/interstitial.

A single bounded fetch through the existing DNS/public-address/robots-respecting source session returned HTTP200 in 2,150ms, 199,899 document bytes, 6,346 visible text characters; classifier `html_available`, `requires_rendering:false`. Session used two requests including robots and 200,072 total bytes. A separate normal browser view successfully rendered the official page; screenshot visually inspected at `/tmp/source-followup-melanthi.png`.

Actionable next step: this is accessible substantive server HTML, so a reviewed source extraction can start from the existing permitted document instead of assuming it needs expensive hydration. It is not evidence to expand renderer timeouts. If invoking the rendered-source capture again, use one explicitly authorized diagnostic with stage timings and existing budget, then review actual loaded image bytes and identity before any lease/apply. Current stored Greek title differs from an English listing label, so exact-title automatic promotion may still correctly require human identity review. No immutable enrichment proposal was generated here.

## Comunità Ellenica delle Marche

Listing `08106b1c-4664-47a1-b7cc-cd7cf575b050`; recorded source was `http://www.comunitaellenicamarche.weebly.com/` and failed the HTTPS source contract. Exact-www HTTPS previously failed TLS. The independently discovered usable official URL is **https://comunitaellenicamarche.weebly.com/** . This is a proposed correction supported by source identity, not an automatic removal of www on arbitrary websites.

Evidence chain:
- The [federation member directory](https://www.fccei.it/?page_id=7) search result, crawled today, names this community and the same Weebly site. Direct directory open returned502 during this check; do not claim a fresh successful directory-page fetch.
- The indexed [official Chi siamo page](https://comunitaellenicamarche.weebly.com/chi-siamo.html) uses the non-www HTTPS domain, identifies the association in Recanati/Marche and its cultural mission. Search/cache evidence is distinguished from the fresh source request below.
- A single guarded fresh request to non-www HTTPS returned HTTP200 in 1,125ms, 62,755 document bytes, 10,803 visible characters; classifier `html_available`, no JavaScript rendering required. Robots plus document consumed two requests/62,937 bytes. The normal browser then visibly rendered the same community logo/name and Recanati introduction. Screenshot inspected: `/tmp/source-followup-marche.png`.

The page title is the generic `Consiglio Direttivo`; exact-title automatic identity checks should not be weakened. Current and historical announcements coexist, and the prominent Greek-island picture is cultural decoration, not proof of the association's physical premises. Do not promote it as a venue photograph or import old event dates as current.

Actionable prerequisite: parent can prepare a narrowly guarded website-source reconciliation to the verified HTTPS non-www URL, checking exact listing identity, unchanged old source and owner/base hashes, preserving owner-managed data and canonical route. Obtain a fresh source fingerprint and genuine lease only after that reviewed correction. Then build a bounded independently reviewed source subset; do not apply the old HTTP capture against a new-source fingerprint. No such mutation was performed here.

## Reproducible evidence and limits

Temporary diagnostic script `/tmp/source-followup.mjs`; measured results `/tmp/source-followup-20261001.json`; raw source documents `/tmp/source-followup-{melanthi,marche}.html`. Each source session was capped at five requests, 2MB and25s. Browser screenshots confirm genuine rendering in this environment, not completion of the stricter image-loaded enrichment capture or compatibility with every region/device. Browser closed; no forms or external communications used.

## Marche website correction applied by lead

Lead independently opened the official Chi siamo page and verified the community identity. A locked exact-row-hash transaction was first tested with rollback, then committed once. Only `website` changed to the verified HTTPS non-www host; `source_url` remains the federation discovery reference, and all other fields were guarded unchanged. Follow-up read confirms fingerprint `69a47d1a58945cff786540bedb5fc342`, unchanged profile hash `c6c57e1563aea9951d36b0e75deb4e70`, and unchanged unclaimed/unowned state. Historical rollback-form SQL is recorded in `ops/marche-official-website-repair.sql`; it is not a replay request.

The canonical `/organization/comunit-ellenica-delle-marche` returns the corrected official website link in its actual HTML. This repairs the visitor link and source URL prerequisite; it does not claim the community profile is fully enriched. No machine profile fields or old source captures were promoted.

## Single protected Melanthi capture after source revalidation

Parent supplied the current unchanged-source fingerprint `d162ff8739a05071a5e4e7cf5181bb26`. Protected browser preflight passed with `chromiumSandbox:true`, Chromium151.0.7922.34 and zero external page requests. Exactly one `renderOfficialSource` capture then ran with existing default40s invocation/30s navigation/80-request/15MB limits, public-DNS/robots gates and no TLS or sandbox exceptions.

It returned **repair_required / source_render_timeout**, not usable enrichment. Immutable artifact: `.recovery/melanthi-reviewed/818eafcc36c5a21ac43860785a1139459920734a409a723938c963d56555aae5.json`; SHA256 verified and file made read-only. The original current fingerprint is retained. `ops/melanthi-reviewed-source-proposal.json` records a blocked capture with `approved_profile_candidate:null`, not a fabricated content proposal.

No capture retry, worker dispatch, queue lease or apply followed. There are no successfully captured image-byte receipts to review from this failed run. Normal browser and permitted HTML evidence above remain useful source research but are **not** relabeled as protected rendered-source evidence. Existing failure receipt does not identify the timed-out phase, so exact renderer diagnosis still needs stage-timed instrumentation or a separately authorized source-HTML reviewed-capture path. Raising timeouts or weakening guards is not justified by this result.

Independent read-only Marche verification after parent commit confirms website `https://comunitaellenicamarche.weebly.com/`, unchanged federation source_url `http://www.fccei.it/?page_id=7`, profile hash `c6c57e1563aea9951d36b0e75deb4e70`, published/clean. This confirms the narrow website correction; it does not claim machine enrichment or content review completion.
