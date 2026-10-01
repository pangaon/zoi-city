# Workspace identity and private settings acceptance

Run `CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/workspace-settings/verify.cjs` from the repository root (existing Playwright dependency required).

Actual suite settings UI at 390/1440 against controlled RPCs: authoritative workspace name differs from AI business name, lost rename reply recovers by readback, mismatched name does not claim success or resend, delayed account change cannot repaint private fields, and permission denial removes private settings. No production account or writes. Browser/server close on completion/failure; page errors fail assertions. The separate PostgreSQL test exercises real rename authorization against synthetic records.
