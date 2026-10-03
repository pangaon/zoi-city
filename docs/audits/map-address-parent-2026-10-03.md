# Independent published-address and numeric direction review

The lead reconstructed all 5,831 exact files in producer manifest
`409638a7c13f3c16ed081866e44a1e094f9c1859f760e7305f3fdfae460dcdb2`
into a separate snapshot, verifying each SHA and byte count. The three changed
runtime files were compared to deployed 95d63fd and reviewed independently.

The lookup builds a bounded Google Maps search using published listing name,
postal address, city and country. It refuses city/country-only values and does
not infer coordinates, distance or a provider place ID. Unknown and area results
use an explicit address-search label. Fresh public details replace the address
choice; owner clears remove stale actions. The preview validates the external
provider URL and prevents the generic Quick look Directions link from restoring
an action after the map policy has withheld it. Closing the preview fences late
details. Phone and desktop share the same correction.

Numeric routing now requires the existing exact reviewed receipt: matching
listing, request, street precision and current coordinates. An imported street
tag alone no longer enables numerical directions. The meaningful pre-candidate
regression and producer's initial provider failure remain retained separately.

Independent focused checks passed 29 groups. The actual DOM/runtime replay
passed 36 controlled journeys at 390 and 1440 pixels, including wrong-record and
wrong-coordinate proof, missing proof, valid proof, owner clears, private/wrong
identity results, preview disposal and city/world scope. Parent logs and the
distinct replay screenshots are retained under
`docs/audits/evidence/map-address-parent-2026-10-03/`.

The producer separately exercised four anonymous candidate journeys with actual
public readers, provider basemap and imagery: Toronto All Saints address search
and Olympia's reviewed numerical point, at both widths. This evidence is a
candidate overlay, not deployment acceptance. No writes or coordinates changed.
Its final runs still required 36–44 seconds for the whole-map feed; one earlier
data request failed and retried, and a desktop basemap was still loading at a
capture. Those are material existing limitations, not a complete or fast map.

The address/proof correction is accepted for code integration. A separate startup
work packet is now addressing the existing global-feed wait before map/UI
construction. It will require its own source and journey review. Full reviewed
street coverage, venue entrances, physical native maps and current production
acceptance remain open.
