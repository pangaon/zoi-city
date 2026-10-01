# Core transport session transitions

`node tests/browser/core-session-transition/audit.mjs` executes actual shared Core in a Node VM with controlled storage/fetch and writes /tmp/core-session-transition-audit.json (override OUTPUT).

`EXPECT_FIXED=1 node tests/browser/core-session-transition/audit.mjs` requires all queued actor/logout transitions to prevent sending, cross-tab loaded-account changes to refuse old responses, and legitimate same-actor refresh to preserve an in-flight response.

This is actual Core transport evidence, not a rendered browser journey or live Auth test. No network or real credentials are used.
