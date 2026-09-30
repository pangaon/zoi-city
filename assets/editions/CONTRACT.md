# Category editions

`categoryEditionBody({category,label,scope:{country,region,city},rows,total,page,path,sponsor:null,now})` returns server-rendered HTML or `null` for categories outside its supported set. Import from `api/_category-edition.js`. New CSS/module are included in the returned body. No new RPC, user profile, queue or paid integration.

Supported actual categories: restaurants, bakeries, musicians-djs, lawyers, doctors. General artists/professionals definitions are available for future verified category mappings; live `professionals` category currently has zero results and must not be invented.

Integration: after existing `explore_place_listings` and resolved canonical geography, call this instead of the generic hero + featured clones + grid. Preserve caller pagination, canonical metadata, breadcrumb/location routing and optional sibling links. A category-specific body contains one h1 and every supplied valid row exactly once. First 12 visible; remainder expandable with native details. On-page search explicitly searches only returned rows, never pretends to query the complete category. More pages continue through caller pagination.

Rows must be actual public `explore_place_listings` output. Renderer additionally fences category and every nonempty geography field, rejects duplicate IDs/unsupported home routes and escapes content. It preserves server order; it does not label places as best or recommended. Locality is shown city, region, country, never inferred from a source organization.

`photo` currently coalesces photos and logos in the existing RPC. It is rendered only as a compact contained thumbnail, never a hero. An absent photo takes no reserved image space. Do not infer image subject or food/menu availability.

## Optional sponsorship boundary

No live sponsor inventory retrieval, campaign payment workflow or auction is implemented here. Pass `sponsor:null` until a server-authorized producer exists. Never accept this object from URL/client input.

Eligible server object requires:
- id, listing_id, actual public listing object whose id/category/geography and canonical home href match
- exact category and exact scope (country/region/city), including global versus local distinction
- status approved, payment_status confirmed, finite active starts_at/ends_at
- creative: matching listing_id, status approved, kind photograph, HTTPS url/source without credentials, width >=1200, height >=600, descriptive alt and attribution credit
- title and canonical internal business/artist/creator/professional/venue/vendor href

Expired, wrong-city/category, unknown/paid-pending campaigns, logos and small creatives are omitted. Accepted placement visibly says Sponsored and identifies photo source. This helper is a last-mile validation contract, not authority to charge or certify a campaign.

## Evidence

7 local model/renderer tests cover geography, escaping, no invented hero, sponsorship exclusion/disclosure, supported family rendering and complete bounded pagination. Browser fixture uses an actual read-only snapshot from production (restaurants1937, bakeries499, musicians455, lawyers842 total); it does not write production. Snapshot descriptions retain source accuracy limitations. Actual composed caller integration and additional category visuals remain separate acceptance steps.

## Reviewed photo hero (implemented)

`categoryEditorialRequest({category,scope})` returns the exact Twelve Islands slug/id only for restaurants with a compatible global/United States/Stirling scope and no unknown region claim. Caller may resolve this once through existing public `seo_entity` with a bounded timeout and pass its current result as `editorialEntity`. If lookup fails or returns no public entity, use null. No cached static listing can override a missing/hidden current public result.

`categoryEditorial` then verifies exact UUID, website against frozen reviewedRestaurantBrand, actual category_slug, and all requested geography. Photograph/credit are reused from `assets/homes/templates/restaurant/brands.mjs`, not the generic coalesced photo field. Hero links the actual business home and says “In the frame” plus its real city/country and photo attribution. It is editorial, not a fabricated paid campaign or recommendation rank.

2026-09-30 metadata evidence: Twelve Islands is published/clean/nonhidden, restaurants, Stirling, United States, region NULL. Thus New Jersey scoped requests currently cannot show this hero. Avli is published/clean, category **tavernas**, Bochum/Germany, region NULL; it is not silently inserted into restaurants. Taxonomy/region omissions require a separate reviewed data repair.

9 tests now include wrong-city/region/category/source/UUID and no-current-public-entity rejection for the photo hero. Bakery/artist/professional editions have honest typography fallback until their own reviewed images and runtime visibility checks are supplied.
