# Independent installed-service production boundary

Run only after the release lead confirms this exact pushed commit has a READY deployment serving the production aliases:

```sh
RELEASE_COMMIT=<40-character-pushed-SHA> RELEASE_DEPLOYMENT=<matching-ready-deployment> node tests/browser/service-installed-production-independent/verify.cjs
```

The verifier compares 17 deployed HTML/script/style bytes with immutable `git show` source, including the preserved Parea imports. Fresh browser contexts load actual production Core, Social registrations and table-group runtime at 390px and 1440px. It exercises the signed-out guest service action, preserves the original sign-in tools, and rejects missing, invalid and repeated event parameters. No Core stubs or fixtures are inserted. Protected API requests and non-read requests are intercepted before dispatch and fail the review. No sign-in code, order, admission or cash action is sent.

Evidence includes full-page screenshots, source hashes, loaded assets, errors and intercepted requests. This validates real entry deployment and the signed-out privacy boundary. It does not prove a real event is configured, online payment is connected, or authenticated production order/admission/cash journeys have been exercised. Installed backend manifest and private ACL evidence remain separate.
