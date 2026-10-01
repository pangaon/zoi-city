# Versioned settings acceptance

Run `node tests/browser/workspace-settings-cas/verify.cjs` with Playwright-core and
local Chromium (or set CHROMIUM_EXECUTABLE_PATH). Exercises actual settings.js at
390/1440 using controlled RPCs: conflicts and deliberate reapply, lost receipt,
unknown request remount and cancellation, voice use-latest, storage failure before
any write and account-change cleanup. No live settings writes. PostgreSQL behavior
is separately tested by tests/database/workspace-settings-cas.integration.mjs.

The local server injects the suite shell's actual inline styles and shared
zoi-theme.css into the fixture. Screenshots of conflict and unknown/cancellation
states are written to /tmp/settings-cas-{conflict,unknown}-{390,1440}.png.
External network access is blocked, including external fonts; no design token
copy is maintained in this fixture.
