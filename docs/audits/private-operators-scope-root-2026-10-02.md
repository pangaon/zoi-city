# Private Properties and Timekeeping — root integration, 2026-10-02

Independent baseline reproduced private reads for the old workspace after a queued Core token refresh despite a workspace change or detached surface. The correction captures UUID account/workspace and current surface, refreshes then rechecks before transport, and rechecks responses. Denial clears private state and DOM. Both wrappers return cleanup and reject held imports after account, workspace or surface replacement. Detached retained roots also clear their private contents before possible reattachment.

Root implemented runtime; independent reviewer owns the acceptance harness. Root ran 12 actual-Core fixed read cases and six model tests. Independent review passed the original 12 read cases and 52 expanded actual-wrapper read/write, invalid identity, late response, denial, refresh failure, cleanup and held import cases at390/1440, plus six units. See the independent audit for exact limits. Cache versions updated on wrapper modules, shared helper and Social loader. No database schema or operational mutation was performed.

Candidate hashes:
- `assets/suite/private-operator-scope.mjs`: `959eaeded98a78677188336a2187d802251f62d56f21d2a74f87bb7cbb81af87`
- `assets/properties/operator.mjs`: `d6da695f7aa9f9a01051a86d12e59de2b5f80decce8e7c2434cb9672a39e3722`
- `assets/timekeeping/operator.mjs`: `21556a8877d8d9a665d59fa4443c8085cd2f1b5b8b182bcd330951523be5b561`
- `assets/suite/properties.js`: `916955a0abe24ba5077c957ece3128c9e073d912c2227ff00d358fe183ee6581`
- `assets/suite/timekeeping.js`: `9e39bddc1b4bc692c4a5b2dc32b25dce5212a9053703b88f36537fe7384d7afc`
