# Geo covering UUID-order index proposal

Run from the immutable snapshot with PostgreSQL16 binaries installed:

```sh
QA_GEO_ORDER_PORT=15774 QA_GEO_ORDER_EVIDENCE=/tmp/geo-order.json node tests/database/explore-geo-covering-order.integration.mjs
```

No node dependencies are required. The harness starts its own temporary Unix-socket cluster, binds no TCP interface, and removes it in finally. It uses only captured function/view/canonicalizer definitions and synthetic rows. It never connects to production. Port15773 was producer-owned; reviewers should choose a distinct PGPORT override.

27 groups cover 32000 wide rows, 13 complete-object paged oracles, both installed geo overloads, three public roles/direct private-table denial, four concurrent actual read connections, owner/source/visibility/version/null mutations, exact source/view/helper/authority drift and collision/replay negatives. No VACUUM, ANALYZE, increased timeout or planner override occurs. After restart natural deep plans must use the covering IndexOnlyScan and avoid disk sorting; heap fetches remain possible because the fixture is deliberately dirty. Before plans were warmed by oracle reads; after shared-buffer restart retains OS caches. Timing is supporting evidence rather than a pass threshold or production guarantee.

The CLI-generated migration is index-only. Public geo readers, helpers/view, listing contents, ACLs, visibility, coordinates and precision remain unchanged. No production installation is claimed. Root owns fresh production preflight and install/ledger review plus real-client post-install acceptance.
