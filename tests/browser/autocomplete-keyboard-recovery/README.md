# Keyboard recovery in shared autocomplete

Run `CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node tests/browser/autocomplete-keyboard-recovery/verify.cjs`.

Serves actual Explore and Map documents/assets locally at 390 and 1440 pixels. All RPCs and external map style requests are controlled; no live backend or writes. Two suggestion failures must expose a keyboard-reachable Retry; Escape returns focus, leaving Retry dismisses the panel, a successful retry makes exactly one request and restores arrow navigation, and stale response release cannot replace the current query. Also checks normal result Tab/outside dismissal.

The pre-correction module fails because input Tab immediately hides Retry. This is a browser UI recovery test, not evidence that the backend outage has recovered or that the separate global palette/creation flows use this module.
