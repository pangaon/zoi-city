# zoi.city — Wave 1 test suite

Automated tests proving the public API contract and page invariants. **Zero npm
dependencies** — everything runs on plain Node.js >= 18 (built-in `fetch`).
No `npm install`, no `package.json` needed.

## Layers

| Layer | Command | Network needed? |
|---|---|---|
| Unit (pure logic) | `node unit/run.mjs` | No — runs anywhere, incl. sandboxes |
| API contract | `node contract/run.mjs` | Yes (Supabase) |
| Page invariants | `node pages/run.mjs` | Yes (www.zoi.city) |

Output is TAP-ish (`ok N - name` / `not ok N - name` + `# diagnostic`); the
exit code is non-zero if any test fails, so all three work directly as CI steps.

### 1. `unit/run.mjs` — pure logic, no network
Tests the shared page helpers copied into `unit/lib.mjs`:
- `esc()` — the 5-entity HTML escaper (`& < > " '`), including XSS payloads
  (`<script>`, `<img onerror>`, attribute-breakout quotes) being fully neutralized.
- `relTime()` — relative timestamps (`just now` / `Xm` / `Xh` / `Xd` / localized date),
  with an injectable clock for deterministic boundary tests.

Runs in any environment, including egress-blocked sandboxes.

### 2. `contract/run.mjs` — public API contract (needs network)
Hits the Supabase PostgREST RPC surface (`explore_search`, `explore_cities`,
`explore_fresh`, `explore_geo`, `dir_counts`, `home_stats`, `feed_*`,
`community_*`, `tickets_*`, `bio_get`, `zoi_namedays_today`) and asserts
response shapes, types, and value sanity (e.g. `dir_counts` has 12 types with
`business > 1000`).

Security-critical negative tests (must all pass):
- `tickets_reserve` with random uuids is cleanly rejected (no anonymous reservation).
- `feed_post` without auth is rejected (`sign_in_first` / 401-ish).
- `profile_update` without auth is rejected.
- Anonymous REST table access to the `zoi` schema is impossible
  (`GET /rest/v1/listings?select=*` must not return data; REST root exposes no zoi tables).

Config via env (defaults built in — the anon key is the publishable key, public by design):

```sh
BASE=https://csebihpaychdkanjjsmz.supabase.co \
ANON=sb_publishable_... \
node contract/run.mjs
```

### 3. `pages/run.mjs` — live page invariants (needs network)
Fetches `/`, `/explore`, `/community`, `/tickets`, `/social`, `/explore/app/`
on `https://www.zoi.city` (override with `SITE=` env) and asserts: HTTP 200,
exactly one `<head>`, exactly one `<title>`, a viewport meta tag, plus
page-specific invariants:
- `/explore/app/` contains `noindex` and `Classic prototype`
- `/tickets` contains `online payment is being enabled` and NOT `payment comes later.`
- `/social` contains `location.reload(); }` inside `switchWorkspace`

## GitHub Actions

```yaml
name: wave1-tests
on: [push, workflow_dispatch]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: node _wave1/tests/unit/run.mjs
      - run: node _wave1/tests/contract/run.mjs
      - run: node _wave1/tests/pages/run.mjs
```

## Notes
- The contract and pages layers require outbound network access — they run in
  GitHub Actions or on any normal machine, but not in egress-blocked sandboxes.
  The unit layer runs everywhere.
- All tests are read-only against production except the negative security tests,
  which intentionally attempt writes that must be rejected by the API.
