# Parent review of workspace history and account clearing

The independent reviewer reproduced a prior-account workspace-name leak and
authored the narrow correction. The lead separately inspected its source and
exported HEAD `03203481b3cd9868b2a9b9c63429ca07c0f00697` to
`/tmp/zoi-history-independent-wn9o14a4`, overlaying only the frozen Social HTML
and three browser fixtures. The larger organization suite's concurrent navigation
and module work was excluded from this second review.

Reviewed Social SHA256:
`506d850a4e42c47a31a87b1d73dccfc50774c52283bae445784dfa951a02b439`.
Captured route/generation/token checks prevent late membership responses from
mounting the wrong workspace. Explicit malformed/duplicate history intent clears
the prior private mount. Account transition clears cached workspace names;
recovery choices must come from membership bound to the current token and are
rechecked before mounting. Existing backend authority remains decisive.

Fresh lead runs passed at 390 and 1440 pixels:

- Standard actual-shell Back/Forward, pending-edit cancellation, exact workspace,
  malformed/duplicate/missing/revoked intent and competing held reads.
- Adversarial account transition, invalid route, empty old roster, returning
  account with fresh viewer authority and delayed prior-account response.
- Existing actual-shell organization/community creation and ownership/claim
  tracking, duplicate Enter, lost response, account clearing and exact listing.

Logs: `/tmp/zoi-root-history-standard.log`, `/tmp/zoi-root-history-actor.log`,
`/tmp/zoi-root-history-shell.log`. Fixture changes replace the previous disabled
old form assertion with stronger removal of the old form/draft/roster, selection
of a distinct new-account workspace and its exact viewer authority without a
new mutation. This is accepted local source and exercised controlled evidence.
It is not a production account mutation or proof of backend recovery.
