# Independent audience and asset writer role review

Local candidate reviewed 1 October 2026; no live schema changes, customer reads or business RPC invocation.

The five existing mutation signatures now call the dedicated writer guard. Explicit membership takes precedence over historical creator/owner authority; owner/admin/editor can write, viewer cannot. Legacy owner authority remains only when membership is absent. Audience read/export behavior remains available to authorized readers, and marketing-consent capability is separately derived rather than inferred from audience write access. Private helpers are not executable by public client roles.

Initial read raised an absence race: a workspace SHARE lock would not block a concurrent membership insert's foreign-key KEY SHARE lock. The specialist changed writer authorization to lock workspace FOR UPDATE before membership FOR SHARE and added actual relevant foreign keys to the isolated fixture. Both synchronized orderings pass: viewer insertion first causes the waiting writer to deny; authorized writer first serializes the insertion and subsequent writes deny. Existing role update/delete also conflicts with the membership SHARE lock. No lock-free blanket legacy bypass was accepted.

Independently ran 12 PostgreSQL checks and actual-module browser fixtures at 390/1440. Covered all five mutation paths for allowed roles, viewer denial despite legacy ownership, anonymous/unrelated actors, foreign IDs, revocation, both absence races and helper grants. Browser covers viewer list/export, editor add/edit/delete/import, server role denial and private cleanup across account/workspace change. No browser errors observed. Visually inspected phone viewer and desktop editor; the narrow phone table uses contained horizontal scrolling. Export-enabled assertion passed after import. No physical-device acceptance is inferred.

Accepted hashes:

- `assets/suite/audience.js`: `6055bc1f4d4569638408d61a01f8460384f7524262797e42dd3bff91b74be995`
- `20261001030747_audience_asset_writer_roles.sql`: `0ce532bb606e7f839030fdd730b4f7a11c9b4d839d853f191d59431044500245`

This acceptance is scoped to role enforcement and the exercised client recovery. It does not establish transactional idempotency for every audience mutation, marketing delivery, full legacy RPC security or production deployment. Lead retains application and effective-grant/body readback ownership.
