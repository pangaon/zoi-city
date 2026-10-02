# Service installed-capability verification

Run from the repository root:

```sh
CHROMIUM_EXECUTABLE_PATH=/home/codespace/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome node tests/browser/service-capabilities/verify.cjs
node --test tests/unit/service-capabilities.test.mjs
node tests/database/service-capabilities.integration.mjs
node tests/database/service-menu.integration.mjs
node tests/database/service-queue.integration.mjs
```

The browser serves the actual Menu, paused setup, queue, organizer session and guest order modules with the existing controlled fixtures. It intercepts the capability response explicitly; no production APIs are used. Ten phone/desktop cases preload a valid unknown request, verify absent/malformed installation causes **only capability calls**, preserves the original marker and disables recovery, then explicitly refresh availability and cancel the exact request after proof becomes valid. No service mutation is issued. Screenshots are retained under `/tmp/service-capabilities-candidate`.

The existing per-tool verify/shell tests cover successful edits, lifecycle/cash requests and receipt recovery with an explicitly valid capability envelope. The family ownership tests retain account/workspace/owned surface retirement. The standalone PostgreSQL harness loads retained real migrations and tests partial/full installation, exact source and enabled guards, current role/session, direct table/function privileges and legacy KDS consume-once behavior.

Tickets Studio's source page immediately redirects to `/tickets`. It is unchanged. Compatibility tests exercise old RPC signatures for older cached clients; no new live Studio controls or active route are claimed. Parent integration must include the two Suite registrations/navigation entries and their versioned dependency chain. Guest service host mount and schema installation remain separately controlled by the lead.
