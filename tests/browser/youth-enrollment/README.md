# Youth enrollment acceptance fixtures

These fixtures load the actual `ZoiCore`, Youth components and composed Groups wrapper. Every Youth RPC is executed against an isolated PostgreSQL16 fixture; other adult Groups metadata is a bounded stub. They never contact production or send messages. Synthetic names are fixture data, not public client records.

Run from the repository root with PostgreSQL16 and Chromium installed:

```sh
ZOI_YOUTH_PGPORT=15513 ZOI_YOUTH_KEEP_FIXTURE=1 node tests/database/youth-recovery.integration.mjs
NODE_PATH="$PWD/node_modules" node tests/browser/youth-enrollment/verify.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/youth-enrollment/groups.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/youth-enrollment/public.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/youth-enrollment/capability.cjs
NODE_PATH="$PWD/node_modules" node tests/browser/youth-enrollment/scope.cjs
node --test tests/unit/youth-recovery.test.mjs tests/unit/organization-private-scope.test.mjs
```

The SQL fixture writes `.recovery/youth-recovery-pg.json` with the local socket/port; browser files read that descriptor. Use a distinct `ZOI_YOUTH_PGPORT` for independent runs. Do not execute lifecycle verifiers concurrently against the same descriptor: each truncates synthetic records. The DB fixture has 28 assertion groups, including current authority after waits, NULL role denial, cancellation/create serialization, token expiry, version conflicts, separate Auth/profile IDs and private helper/table access.

`verify` and `groups` exercise 390/1440 staff publication with a lost reply and remount recovery, explicit instructor/class links, guardian child create with a lost reply, enrollment, approval, attendance, policy renewal and withdrawal. `public` exercises signed-out catalogue, terms and sign-in with no private call/write. `capability` retains request markers and makes zero mutation/recovery calls for absent/malformed/stale-account capabilities. `scope` exercises delayed auth refresh and retained response after account/workspace/replacement/unmount. Every browser verifier rejects uncaught page exceptions.

Cleanup only the local fixture described in `.recovery/youth-recovery-pg.json`: `pg_ctl -D <descriptor.dir>/data -m fast -w stop`. Keep that descriptor private/untracked. Production installation, production authenticated enrollment and physical mobile acceptance remain separate release checks.
