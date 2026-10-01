# Shared youth/group queued scope correction

Source inspection of the common privateScope RPC wrapper found a same-actor workspace transition could occur inside Core's required-auth refresh after the wrapper's initial check. The request could send its old workspace arguments before the postresponse check rejected it.

A controlled regression fixture in tests/unit/organization-queued-scope.test.mjs demonstrates the old behavior for youth reads/writes and group reads, detached surfaces, normal refresh and failed refresh. Baseline assertions fail; after correction all six pass. Combined with existing organization-private-scope tests, 14 pass (`/tmp/organization-queued-fixed.log`).

The wrapper now explicitly refreshes required authentication, rechecks current workspace/actor/surface, rejects failed refresh before transport, then uses Core's already available token without another refresh queue. 401/403 clears private state. Optional public reads preserve their existing authentication mode. No new requests, retries, or backend mutations are introduced.

This is local source/controlled unit evidence only. Independent review, mounted youth/group journeys, entrypoint cache integration and production release remain pending.
