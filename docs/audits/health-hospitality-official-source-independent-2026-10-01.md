# Independent health and hospitality official website review

Reviewed 2026-10-01. Accepted for the bounded source-navigation change; production deployment and live source mutation are not asserted.

## Frozen runtime

- health/model.mjs: `35f1fbd0379d5555ecf07e9411d43c68659d5052e3c4f384ce6334fa008eacca`
- health/render.mjs: `61232b4aba8084af2b028839dfcdf09b7d3aa1594772ffce71aa814359cb6a7f`
- health/app.mjs: `5c925926edb8e930b227114f958b1360b2f17a34d9b9c077b6477fd0c03b5997`
- hospitality/model.mjs: `b9f403475620b5abe0bbc715a2c0183324d1c1da84b75e84c6428153badf22de`

Paths above are under assets/homes/templates. Parent owns cache integration.

## Source contract

Explicit owner website values, including null or empty clear, override the imported website. HTTP and HTTPS are navigation destinations only; credentials and unsafe schemes are refused. Existing HTTPS-only media handling remains. Health contact links, copied contact text and downloaded vCard use the current website; retained source attribution remains separately available and does not falsely become the updated website. Hospitality curated source checks now use the resolved owner website, preventing cleared or changed websites from reviving old curated rooms or provider assumptions.

## Independently exercised

37 units passed across health-home, hospitality-home, hospitality-source-catalog, hospitality-owner-catalog and health-hospitality-official-source. Log: /tmp/health-hospitality-units-independent.log.

24 actual renderer/client browser cases passed: both families, populated and sparse fixtures, HTTP/HTTPS/explicit clear, at 390 and 1440 pixels. Browser destination interception occurs at context level; health vCard downloads are actually inspected. Report: /tmp/health-hospitality-independent/report.json; log: /tmp/health-hospitality-browser-independent.log. All reported overflow checks are false. Inspected phone health populated HTTP contact screenshot and desktop sparse hospitality HTTPS screenshot: website actions remain legible; sparse hotel explicitly says online booking is not configured. The health capture includes the temporary download notification over the lower owner card, not the website control.

Fixtures are controlled post-save states, not production owner writes. Units additionally cover overlay-only owner updates, unsafe values, provenance continuity and media refusal. No live external provider navigation, booking, patient intake, enrichment mutation or full-category completeness is claimed. These checks establish this shared navigation correction, not complete health/hospitality delivery.
