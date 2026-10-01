# Hospitality social links and sparse services

Shared candidate; not a deployment claim. Actual source-reviewed Moongarden public payload was rendered locally through the production hospitality renderer, without data mutation.

- All four hospitality designs now display authoritative official social links and matching Hotel JSON-LD `sameAs`. The shared resolver preserves owner replacement and explicit null/empty clears. Unsafe URLs are omitted.
- Empty Rooms, Dining, Occasions and photo sections and their navigation links are absent. Populated services, owner section ordering and hidden sections remain supported. A sparse stay plan does not ask for a nonexistent room type. Website and fallback description no longer imply dining or connected booking.
- 24 focused hospitality/social/media tests passed. Coverage includes all four designs, populated and sparse services, owner replacement/clear, unsafe links and structured data.
- Actual local browser at 390 and 1440: gallery opened the reviewed bedroom photograph; date/guest plan submitted with no room selector and produced the correct telephone next step plus explicit no-reservation status. Date values were set on native date controls through DOM events because the automation CLI date fill cleared them; submission used the actual button. No provider booking, call, email or message was sent.
- Source Facebook href is `https://www.facebook.com/MoongardenBoutiqueResort/`. An owner-empty fixture rendered zero social links and no `sameAs`. No browser errors or horizontal overflow observed.
- Inspected screenshots: `/tmp/hospitality-gallery390.png`, `/tmp/hospitality-plan390.png`, `/tmp/hospitality-plan1440.png`, `/tmp/hospitality-social390.png`. Browser closed. This proves local shared rendering and planning behavior, not production deployment or external Facebook login/playback.
