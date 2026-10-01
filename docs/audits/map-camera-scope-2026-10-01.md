# Map camera scope correction

Bounded follow-up to the independently accepted count/footer correction. No source coordinates changed. Existing footer/count diff preserved.

The available `assets/zoi-cities.js` is a decorative hero-globe centroid list with mixed inherited directory/OSM provenance. It is not a verified area boundary contract. The map area's actual results provide trustworthy camera bounds only through `mapTools.matchBounds`, which excludes coarse/invalid positions. We do not turn the decorative centroids or unpositioned search results into map pins.

When an explicit search or area navigation has no street-level bounds, the map now stops previous animation and jumps to neutral world centre [0,0], requested zoom 0.6, zero bearing/pitch. MapLibre may raise the actual world zoom slightly to cover the viewport (0.71 on the tested phone); this remains a world view. Both motion modes use an immediate reset, so the previous city cannot remain behind the next area's unpositioned list. Explicit shared camera hashes remain respected by existing history behavior. The footer describes only loaded results, not a claim that an entire city lacks addresses.

Owned runtime: `explore/map/index.html`. Dedicated new fixture: `tests/browser/map-scope-context/verify-camera.cjs`. This audit. No deployment, source writes, geocoding or synthetic listing coordinates.

Verification:

- Existing 51 map unit checks pass.
- Original scope/count browser fixture passes at 390/1440 after correction.
- New actual mounted camera fixture passes four combinations: 390/1440 and reduced/default motion. It checks Toronto's actual street-position fit, Nairobi without positions resets world, Toronto return refits, and London's city-only record cannot provide street bounds. Existing delayed stats, paging/retry, sparse list and no-browser-error checks remain included; mobile overflow asserted.
- Inspected `/tmp/map-camera-reduce-390.png`: sparse Nairobi list now overlays neutral world, no Toronto background. Footer remains readable in the sheet.

This corrects stale camera context; it does not establish missing area boundaries or source geocoding. Independent reviewer acceptance and production journey validation remain root-owned release steps.
