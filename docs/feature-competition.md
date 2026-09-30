# Design and functional feature competitions

Requested 2026-09-30. This is a delivery requirement, not evidence that the listed features are live.

Keep all four design choices: Atelier, Concierge, Table and Parea. Each specialist competes on the complete experience: a customer completing a useful task, an authorized owner managing it, and a clear, polished presentation on a phone. Winning patterns become shared capabilities available to the other designs. Do not build four incompatible reservation, payment or identity systems.

## Required evidence for every entry

1. Identify the real entity, its verified official sources, actual services and intended customers. Record uncertain or contradictory source data.
2. Define the customer task, owner task, authoritative records, permissions and completion receipt before implementing the flow.
3. Build the customer flow and authorized management controls. Distinguish enquiry, pending approval, confirmed reservation and completed payment in both UI and stored state.
4. Exercise successful completion, cancellation or withdrawal where applicable, missing data, unauthorized access, duplicate submission, lost response and concurrent inventory changes where relevant.
5. Verify phone and desktop layouts, keyboard access, accessible form errors, reduced motion, loading and empty states. Record native capability parity or the specific remaining gap.
6. Provide the deployed URL, release identifier and evidence of the actual production flow. Label local-only tests and provider-blocked paths explicitly. Never substitute a screenshot, fake receipt or invented dataset for a working transaction.

Private owner drafts and preview changes must not publish automatically. Operational editing uses domain permissions and validation. Restoring a design cannot restore obsolete prices, consumed inventory or revoked permissions.

## Judging

An entry fails acceptance if authorization, data integrity or advertised task completion fails, regardless of its visual score. After those gates pass, score task usefulness/completion (30), owner control (20), mobile usability/accessibility (20), design distinction/polish (15), and reliability/performance/test evidence (15). Production readiness is reported separately from the score.

Run competing experiments for genuinely uncertain design or workflow choices. Reuse the proven backend and common tests. Use local previews and focused tests before a coherent deployment; do not create paid builds for every visual iteration.

## Retroactive restaurant work

All four live Avli entries are included. Their current source-backed menus, gallery, contact and personal occasion-planning tools remain useful. They do not establish live restaurant inventory or platform-managed reservations.

| Entry | Next functional emphasis | Owner control and acceptance |
| --- | --- | --- |
| Atelier | Source-backed menus, offers and private-event discovery | Edit/pause real offers and approved wording/images; visitors see only published records |
| Concierge | Guided occasion enquiry and visit planning | Manage incoming enquiries and their real status; submission/retry produces one enquiry |
| Table | Mobile service selection and reservation or enquiry path | Configure real services, hours and bookable capacity where enabled; never convert an enquiry into a confirmed booking |
| Parea | Group plans, sharing and event coordination | Manage applicable group/private-event services; personal plans remain separate from provider confirmation |

Shared restaurant completion scope: selectable design, accessible section and offering ordering, private draft/preview/publish/history, offer editing, real menu/media management, authenticated enquiry handling and booking integration where actual inventory exists. Pickup, ordering, deposits and payment are added only through verified catalogue, fulfilment and checkout records. No ordering button should imply that a restaurant receives orders before that integration is operating.

## Brick-and-mortar applicability

Classify from verified offerings, not category name alone. A business can enable more than one service model.

| Business type | Customer tasks to implement when applicable | Owner operations |
| --- | --- | --- |
| Retail | Discover products, select valid variants, check pickup/delivery, buy | Catalogue, stock, offer publication, fulfilment, returns and checkout integration |
| Salon or appointment service | Select service/staff, see real availability, book/reschedule/cancel | Staff/resource calendars, duration/buffers, policies, capacity and appointment status |
| Restaurant or cafe | View current menu, reserve or enquire, plan a group visit, order where enabled | Menus/offers, hours, tables/capacity, enquiries and configured ordering |
| Venue or event space | Assess sourced capacity/accessibility, request dates, review an actual quote | Availability, rooms/resources, quote approvals, deposits and booking terms |
| Studio, club or school | Find an appropriate programme, register, manage attendance | Programme schedules, capacity, enrolment and private rosters; guardian consent for children |

Next competitions remain four designs each for a real church, singer, influencer and professional. Each must include its own relevant functional task and owner operations, rather than applying a restaurant workflow indiscriminately.

## Systematic rollout

Inventory actual listings and existing operational records; assign reusable capability sets with source evidence; flag ambiguous classifications for review. Offer all compatible designs through the owner editor. Keep verified data and operational state independent of the selected design. Preview representative categories and incomplete records before expanding deployment. Record what a customer and owner can now do, live links, limitations and the next uncompleted acceptance gate in plain English.
