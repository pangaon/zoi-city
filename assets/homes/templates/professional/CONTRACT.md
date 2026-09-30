# Professional homes: Giota Noussi

Frozen implementation candidates, not a claim of production deployment.

## Public adapter
`api/_professional-home.js`: `renderProfessionalHome(entity, publishedDesign?)` returns HTML only for listing UUID `49de0f3b-aa0e-4811-8135-09af0c77dadd`, entity_type professional, HTTPS official host advokatgrekland.com, visible published state when supplied. Defaults Concierge; supports atelier/concierge/table/parea and approved copy/section_order/hidden_sections. Canonical `/professional/advokatbyran-giota-noussi-athens`.

Shared pure renderer/model and browser client under `assets/homes/templates/professional`. Showcase routes: `/showcase/professional/advokatbyran-giota-noussi-athens/{atelier,concierge,table,parea}/`.

## Verified source
Official homepage and biography fetched 2026-09-30. Six practice-area names link to actual official subpages. Mobile +30 694 706 0910, email giota.noussi@gmail.com, Athens address and Swedish/Greek/English verified on homepage. The site's two conflicting landlines and old legal articles were not reproduced. No up-to-date legal rules/advice, outcomes or availability claimed.

Important correction: `noussi-white1.png` is the practice wordmark, not a portrait. It appears as a labelled logo on a dark background. `noussi4.jpg` is the site's legal illustration, explicitly labelled as such; it is not represented as the practice's office or a portrait. Source images were visually inspected. Source payload retained in showcase source.json.

## Useful customer flow
Select a practice area → read its short source-backed summary on Zoi → prepare topic/language/checklist → save locally, copy, edit, clear → call/email directly. Only enums stored under `zoi.professional.checklist.v1.<listing-id>`. No free-text case details, names, IDs, documents, legal conclusions, intake submissions or false appointments. Local persistence verified by readback; blocked storage has honest copy fallback. Escape restores invoking control. Browser client performs no automatic contact or submission.

Private enquiries button calls existing anonymous `inquiry_availability(p_listing)`. Only valid `{ok:true,available:true}` exposes `/inquiries/?listing=...`; false is explicit, outage offers retry. Owner link goes to existing authorized workspace tools, no new owner system.

## Validation
Five focused model/render/source guard/contrast tests. Four templates at 390/1440 verified no horizontal overflow, six service actions, checklist topic/language retention, local save/reopen and focus restoration. Isolated browser mock tests availability failure→retry→true and false without false intake links. No live mutations. Text/button palette combinations meet 4.5:1; reduced motion respected.
