# Queued AI and Accounts identity journeys

Run `node tests/browser/suite-queued-privacy/verify.cjs`. Set `OUTPUT_DIR` for isolated reviewer evidence and `CHROMIUM_EXECUTABLE_PATH` to override Chromium.

The actual Social shell and actual modules run against synthetic Auth/RPC/provider transports. All external traffic is blocked except explicitly intercepted synthetic OAuth navigation; no real provider is contacted. The OAuth fixture is cross-origin like a real provider, avoiding synthetic same-origin view-transition errors.

At390/1440px, pause token refresh after Generate, change account, then release it: zero old-prompt requests may leave. Hold OAuth response across account change: no obsolete navigation. Positive generation→save and unchanged-account OAuth handoff still succeed. Non-JSON401/403 clears private forms. Missing/opaque actor mounts are denied. Unexpected page errors fail the run. These are client identity/continuation tests, not provider delivery or live billing acceptance.
