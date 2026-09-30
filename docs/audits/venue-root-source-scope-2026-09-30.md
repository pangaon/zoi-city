# Shared-root venue and travel source audit — 2026-09-30

Read-only stored evidence; no source crawling, data writes, cron changes or sign-offs. Five shared-root hosts, 18 root-linked records, one existing property-page comparison and Olympia baseline. `seo_entity` read for four sample records; local canonical adapter evaluated on those exact responses. Hotel-named records span business and travel_place; no separate hotel entity type. This bounded sample does not establish hotel-chain coverage.

## Findings

- Preserve Olympia Express identity: 0004924d-210d-4828-82ed-862802bdf7cd, olympiaexpress.com; stored source identity matches the business, 12 photos. No new full acceptance claim.
- Calgary: root and /banquet-hall/ records share phone4032464553 and the same street address. Shared central contact is supported by existing property-page evidence; do not blanket quarantine. The property-page adapter nevertheless treats rental-rate sheets and a Trustindex star icon as venue photographs. Documents belong in labelled rate information, not photographic hero/gallery; icon must be excluded.
- Olympic Hall 9ca606a8-bb17-43c4-bfce-84de3f442d39: actual canonical adapter selects GOCSA_Default-Social-Share.png as hero and labels it published photograph. Organization biography is imported, but public base description wins, so do not claim the wrong biography is currently displayed. Phone is organization-level; direct hall applicability is not established by the stored root extraction.
- Pretoria: imported construction announcement is unsuitable venue biography, but actual adapter uses existing base description instead. Contacts may legitimately serve the same campus; no contradictory source evidence here.
- Vancouver: all three records contain LinkedIn /shareArticle, a share action rather than organization profile. Exclude machine-derived action URLs through existing shared socialProfile validator; preserve explicit owner links. The travel public rendering was not browser-verified in this audit.
- Cape Town: same source root serves rows at75MountainRoad and24BayRoad plus missing-address rows. Community social accounts are not proof of a specific tour, venue or local booking capability. Stored root provenance alone cannot assign those fields; require specific property/tour scope or explicitly label central organization channels. No evidence justifies blocking the whole host.

## Owner preservation and proposed checks

All19 sampled rows return empty authoritative owner_content. Future repairs must still fence current source fingerprint and owner state at application time. Filter only machine fallbacks, never clear owner-authored fields or explicit nulls. Use field-level categories: property photo vs brand art vs rate document; profile link vs share action; specific property contact vs central organization contact. A root URL, repeated phone or shared image alone is insufficient mismatch evidence. Successful HTTP and populated fields are not acceptance.

## Exact bounded inventory

|ID|Name|Type|Source|
|---|---|---|---|
|7156c968-c242-4959-bec1-484437d11451|Hellenic Community Centre Pretoria|venue|https://behellenic.co.za|
|424b5c60-3876-4e43-acf0-85b3e63db6a8|Hellenic Community Hall Pretoria|venue|https://behellenic.co.za|
|6ca7005b-2c8d-468c-b2ce-4223c870c907|Hellenic Community of Pretoria Dance & Cultural Centre|venue|https://behellenic.co.za/|
|83747df6-54d9-4351-9a58-bc3e60d27d0f|Greek Orthodox Community Hall Adelaide|venue|https://gocsa.org.au|
|6d5aa7ff-10fc-4cc9-bc18-8cf35faa8dbf|Greek Orthodox Community of South Australia|venue|https://gocsa.org.au|
|9ca606a8-bb17-43c4-bfce-84de3f442d39|Olympic Hall|venue|https://gocsa.org.au/|
|e044257b-076c-4cd5-b286-e309d653ae1d|Hellenic Community Centre Vancouver|travel_place|https://helleniccommunity.org|
|3605e915-eaaa-466e-9de9-21e28a4adfd7|Hellenic Community of Vancouver Hall|venue|https://helleniccommunity.org|
|72ad2a76-2994-4ae5-aa7e-c37234a07d56|Hellenic Community Centre Vancouver|venue|https://helleniccommunity.org/|
|a4dc79ba-f64c-4892-9c9c-1f20e7aec5b4|Hellenic Community of Calgary Hall|venue|https://www.calgaryhellenic.ca|
|07eb1356-9edc-472a-b419-2b9de50162c0|Greek Community Hall Calgary|venue|https://www.calgaryhellenic.ca/|
|3a5e2a36-3b2f-418a-adaf-633894656d36|Hellenic Community Hall Calgary|venue|https://www.calgaryhellenic.ca/|
|ce410a14-79f4-4ec0-83b4-5a033dd8ec22|St. Demetrios Banquet Hall, Calgary|venue|https://www.calgaryhellenic.ca/|
|e02dc755-715b-4142-bce6-dfc6c0874c6f|Calgary Hellenic Banquet Hall|venue|https://www.calgaryhellenic.ca/banquet-hall/|
|565ccd0a-63e8-48f0-a597-91dddf0acf96|Greek Orthodox Cathedral St George Heritage Tour|travel_place|https://www.hcct.co.za|
|b2498d04-bc23-4368-a848-1d4d5602715f|Greek Orthodox Community Hall Cape Town|venue|https://www.hcct.co.za|
|35de3563-8fa7-4e37-82cc-ea0e3b25a0ff|Hellenic Community of Cape Town Hall|venue|https://www.hcct.co.za|
|7a28807b-75ec-45b6-a80a-f93338ecc2ad|Hellenic Greek Club Cape Town|venue|https://www.hcct.co.za|
|dffb7b67-d675-433c-8528-038620110a69|Hellenic Community Centre Cape Town|venue|https://www.hcct.co.za/|
