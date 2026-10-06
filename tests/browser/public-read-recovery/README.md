# Public read recovery

Run `NODE_PATH=<directory containing playwright-core> node tests/browser/public-read-recovery/verify.cjs`.

The actual pages/modules are mounted at an isolated synthetic origin; all external requests are intercepted. Sixteen cases cover390/1440, light/dark, controlled slow503/HTML failure then successful empty result, keyboard retry, retained shop basket and property filters, and exact planner URL preservation. No production writes, account or OTP send occurs. This does not verify live inventory, populated provider data or a completed sign-in.
