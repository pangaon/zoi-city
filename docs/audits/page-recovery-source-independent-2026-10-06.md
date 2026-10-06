# Four-page recovery patch: independent source review

Reviewed the current worktree changes in assets/commerce/shop.mjs, assets/leagues/customer.mjs, assets/properties/customer.mjs and assets/event-planner/app.mjs on6October2026. All four pass node --check. No blocking defect found in the bounded changes.

- Shop retry preserves loaded products/basket and reruns the failed read with its pagination mode; checkout and pricing acceptance code is unchanged.
- League retry invokes the existing public read. Existing rapid-season stale-response handling is not improved by this patch and remains outside this approval.
- Property retry stops propagation before the generic dirty-form click handler, and uses the existing busy wrapper. Mutation handlers are unchanged.
- Planner sign-in opens the existing explicit sign-in route in a new tab; the original plan URL is retained and Continue reloads it. This is not a claim that live authentication currently works.

Final independent acceptance: all eight frozen module/entry hashes matched before and after verification. Independently reran the actual-page controlled browser driver:16/16 cases passed at390/1440 in light/dark, including slow503 HTML→keyboard retry→empty success, exact basket preservation, city/mode/search retention, retry removal and planner query retention. No page errors or horizontal overflow. Fixture rejects private/mutation RPCs. Initial runner launch lacked playwright-core in the chosen NODE_PATH; using the existing community-release/node_modules installation resolved the harness setup, and the full run exited0. No application change was needed.

Independent results: evidence/page-recovery-independent-2026-10-06/report.json. Visually inspected and preserved event-plan-390-dark.png; sign-in and continuation are readable. Approval covers this bounded source/runtime/controlled-journey patch, not live provider data or actual sign-in. Navigation browser acceptance is recorded separately in nav12-independent-2026-10-06.md. API incident remains unresolved.
