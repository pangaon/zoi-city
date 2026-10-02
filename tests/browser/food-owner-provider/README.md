# Food owner → menu → current provider / request draft

Run `node tests/browser/food-owner-provider/verify.cjs`. Optional `QA_OUTPUT` and `CHROMIUM_EXECUTABLE_PATH`.

Actual existing Business home editor and menu schema, controlled versioned home_content_get/save contract, fresh editor remount/readback and real canonical restaurant/bakery adapter/render/client. Sources deliberately contain stale provider aliases and seasonal/wholesale text; no real prices or provider status are invented. Owner menu leaves optional price blank. Network is controlled including the real shared phone module dependency; no live writes, provider orders or bookings.

At390/1440 each family edits menu, promotion, order/reservation links and catering, saves/readbacks, opens the current provider by keyboard, clears actual supported fields and verifies old imported destinations do not return. Bakery prepares a local12-item request before and after clear, checking the existing “No order has been placed” state. Screenshots/logs under `/tmp/food-owner-provider` and `/tmp/food-owner-browser.log`.
