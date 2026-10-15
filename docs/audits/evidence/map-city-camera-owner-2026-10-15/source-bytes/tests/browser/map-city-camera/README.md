Run the actual production map with only candidate map HTML overlaid; all APIs,
reviewed points, canonical redirects, assets, tiles and images remain production.
No API fixture, account, SQL or provider navigation is used.

OUTPUT_DIR=/absolute/distinct/proof node tests/browser/map-city-camera/verify.mjs

ZOI_MAP_CITY_BASELINE=1 disables the HTML overlay for the actual deployed negative
control. Use a separate output directory. ZOI_MAP_CASES=390x900 bounds this run.
The report candidate source hash is an expected source pin, not the executed
negative HTML; actual browser response hashes are recorded separately.

390x900 and844x390 retain the existing full control/Saved/city scope regression,
then require camera idle at each requested Athens/Toronto/Melbourne named center
after the exact real city+country response. The named center is only a viewport,
never a listing position or verified coordinate. Public failure status/SQLSTATE/
timing is retained; there is no retry loop for API failures.

Set existing ZOI_PLAYWRIGHT_MODULE/CHROMIUM_EXECUTABLE_PATH only if installed
paths differ. Root owns independent review and live release. Candidate evidence
is not deployed capability or a global-coordinate accuracy claim.
