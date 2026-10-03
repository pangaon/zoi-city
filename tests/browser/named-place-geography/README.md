# Named-place geography controlled journey

Run from repository root:

```
node tests/database/named-place-geography.integration.mjs
node tests/browser/named-place-geography/verify.cjs
```

The isolated PostgreSQL test executes the real extractor, request adapter, original guarded writer plus the new migration, and public reviewed-point reader. It writes a controlled public projection to `/tmp/named-place-geography-projection.json` (`QA_PROJECTED_POINT` override). No production database is contacted. Local PostgreSQL16 binaries are required.

The browser serves repository map assets at their canonical origin and fulfills every RPC from that generated projection. External map-library/tile GETs may occur; non-GET traffic outside the controlled RPC route is blocked. No real account, provider write or location assignment occurs. At390/1440 it exercises a street-zoom pin → actual preview → numeric receipt-backed Directions URL and canonical listing link, plus an unpositioned sparse record with no fabricated pin and address-based directions.

`CHROMIUM_EXECUTABLE_PATH` overrides the installed Chromium path. `QA_OUTPUT_DIR` overrides `/tmp/named-place-geography-browser` for screenshots/report. This is actual renderer acceptance against an isolated server projection, not a claim that Olympia has been updated or production database service recovered.
