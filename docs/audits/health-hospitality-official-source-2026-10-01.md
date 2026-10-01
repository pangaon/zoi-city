# Healthcare and hospitality published website continuity

## Confirmed gap
Retained nurse identity/source: showcase/health/ageliki-tzakis/source.json. Retained hotel identity: Olympia in hospitality/sources.mjs. Controlled post-save fixtures deliberately replace website in both base and owner_content. These do not represent live owner changes.

Before repair, populated healthcare projected the HTTPS website but rendered zero links to it: the contact section omitted website and footer correctly retained independent member provenance. Sparse healthcare exposed it only in the provenance footer. Both healthcare and hospitality dropped HTTP navigation entirely. Baseline16 cases retained in /tmp/health-hospitality-official-source/baseline-report.json.

## Shared repair
Healthcare and hospitality resolve top-level explicit owner website before base, with shared navigation-only officialURL validation. HTTPS-only media and reviewed member-source identity rules are unchanged. Healthcare adds Published website in contact controls, uses that destination in contact vCard, and includes it separately from provenance in copy-contact. Hospitality curated fallback now compares the resolved owner-aware website to the retained source, preventing stale base identity from restoring old curated content after an owner change/clear.

## Acceptance
Four focused unit groups plus33 existing groups pass.24 controlled browser cases pass at390/1440 across both families, populated/sparse and HTTP/HTTPS/clear. Every positive destination is actually clicked and intercepted; healthcare actual downloaded vCards include current website and omit URL after clear. No page errors or horizontal overflow. Artifacts/report: /tmp/health-hospitality-official-source. Phone populated health and desktop sparse hospitality contact screenshots inspected: website action visible and readable. Every healthcare design is covered in rendering unit checks.

## Boundary
This is source-to-public-projection and contact journey repair, not live re-enrichment, booking-provider activation, patient intake, or a category-wide profile audit. Network destinations are controlled fixtures; no production DB mutation or deployment was performed by this specialist. Existing provenance remains available after an owner clears their contact website.
