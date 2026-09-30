# Bakery Concierge

`renderBakeryHome(entity, publishedDesign?)` in `api/_bakery-home.js` returns a complete HTML document only for the existing bakery vertical. Hidden/unpublished or invalid-ID records return null. Vendor records retain their `/vendor/` canonical route; others use `/business/`.

Uses actual profile fields: menu/menu_url, preorder/order_url/order, hours, seasonal, wholesale/catering, photos/logo, phone/email, social links. Price strings stay as supplied; no inferred currency, ingredients, availability, dietary guarantees or pickup time. Owner menu/photo clears take precedence over machine data. Design section_order, hidden_sections and existing copy fields apply; Concierge is the only generic bakery layout implemented here.

Exact Artion Astoria identity (`86b73cdc-d59a-433d-8efe-2271628929d5`) plus official HTTPS artionbakery.com host permits reviewed 2026-09-30 source-image fallback. Images came from its real `/menu` page; that page contains no structured item names/prices, so none are invented. Other bakeries receive no Artion content. Artopolis Chicago source returned 403; its missing content stays missing.

A request draft stores only in this browser under `zoi.bakery.request.v1.<listing-id>`: occasion, details (1–600 chars), quantity (1–1000), preferred date, questions. It is not a business message, preorder, stock reservation or payment. Copy/edit/clear and storage receipt checks are implemented. Private enquiry navigation appears only after valid `inquiry_availability` success with available true. Provider ordering is explicitly labeled as an external handoff.

Browser acceptance: three real records at 390/1440, no overflow, proper identity, draft saved/read back, Escape and focus restoration; all five displayed Artion source images loaded. No production records created.

## Four owner-selectable layouts

`renderBakeryHome(entity, publishedDesign)` now respects `design.template`: Concierge remains default; Atelier uses an editorial title/photograph/story composition; Table puts published menu sections and prices into a counter board; Parea starts with occasion selection. All share real source-guarded data and the existing menu/gallery/request/enquiry actions. No stock/cart/payment claims added. Parea's occasion buttons prefill the local request, preserving the rest of the existing draft. Owner section order, hidden sections and approved copy remain active; hidden offerings do not appear on Table's counter board. Shared source assets are not borrowed between bakeries.

Acceptance: three actual public businesses (Artopolis Chicago, Pâtisserie Artopolis Chomedey, Artion Astoria), all four layouts at 390/1440px; no overflow; per-business stored request and explicit no-order confirmation; Escape restores focus. Missing-photo businesses use typography, never unrelated product photography. Evidence `.recovery/logs/bakery-four-browser-results.json` and `bakery-four-<slug>-<template>-<width>.png`.
