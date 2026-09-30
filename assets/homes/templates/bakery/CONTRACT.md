# Bakery Concierge

`renderBakeryHome(entity, publishedDesign?)` in `api/_bakery-home.js` returns a complete HTML document only for the existing bakery vertical. Hidden/unpublished or invalid-ID records return null. Vendor records retain their `/vendor/` canonical route; others use `/business/`.

Uses actual profile fields: menu/menu_url, preorder/order_url/order, hours, seasonal, wholesale/catering, photos/logo, phone/email, social links. Price strings stay as supplied; no inferred currency, ingredients, availability, dietary guarantees or pickup time. Owner menu/photo clears take precedence over machine data. Design section_order, hidden_sections and existing copy fields apply; Concierge is the only generic bakery layout implemented here.

Exact Artion Astoria identity (`86b73cdc-d59a-433d-8efe-2271628929d5`) plus official HTTPS artionbakery.com host permits reviewed 2026-09-30 source-image fallback. Images came from its real `/menu` page; that page contains no structured item names/prices, so none are invented. Other bakeries receive no Artion content. Artopolis Chicago source returned 403; its missing content stays missing.

A request draft stores only in this browser under `zoi.bakery.request.v1.<listing-id>`: occasion, details (1–600 chars), quantity (1–1000), preferred date, questions. It is not a business message, preorder, stock reservation or payment. Copy/edit/clear and storage receipt checks are implemented. Private enquiry navigation appears only after valid `inquiry_availability` success with available true. Provider ordering is explicitly labeled as an external handoff.

Browser acceptance: three real records at 390/1440, no overflow, proper identity, draft saved/read back, Escape and focus restoration; all five displayed Artion source images loaded. No production records created.
