# Owner core workflow — bounded next correction

Scope: shared business and creator home edit → private design preview → publish → public projection. Reviewed Zoi delivery brief/roles, recovery scope, enterprise owner audit, current design editor, business editor, private preview API, creator adapter and design authorization migration. This is not a declaration that all owner capabilities are complete.

## Proven defect and correction

The shared design editor retained the old private draft/history and iframe after the same signed-in actor lost workspace authority. `home_design_editor` raises `home_design_permission_denied`; the UI catch previously called `render()` with previously loaded data. Account identity checks alone did not cover permission revocation without a sign-out.

`assets/homes/editor.mjs` now clears protected state and DOM on authoritative RPC access refusal (401/403/42501 or explicit permission errors). Durable actor/workspace/listing request storage is not removed. Reload remains available; when access is restored it loads the same pending request without another mutation. Ordinary network failures retain local work.

Private preview handles 401/403 before parsing JSON: an HTML or empty denial response also removes old private content. A non-JSON transient 502 preserves the draft. Scope checks precede clearing, so a response belonging to an old account cannot clear another mount.

`assets/suite/bizpage.js` changes only the editor dynamic-import version. Production module headers currently require revalidation, but an already-running page's module map may retain the old unversioned editor across reopen.

## Exercised evidence

Mounted actual shared `mount()` at 390px and 1440px using controlled in-memory RPC responses; no real owner writes or publication:

- Transient reload failure retains draft.
- Save response loss creates exactly one attempted mutation and retains its exact actor-scoped request.
- Revoked read removes inputs, history, preview iframe and retry/publish controls.
- Durable request bytes remain identical after denial.
- Restored access exposes the same retry without sending another mutation.
- Sign-out and switching to a different actor clear protected controls.
- Non-JSON preview 502 retains draft; non-JSON 403 clears private state.

Repeatable fixture and executable acceptance are in `tests/browser/home-editor-revocation/`; run `node tests/browser/home-editor-revocation/run.cjs`. The harness starts its own loopback server, refuses external requests, asserts no browser errors, and verifies populated private iframe content is cleared after access refusal. Browser closed after checks. Screenshots `/tmp/owner-editor-revoked-390.png` and `-1440.png` capture cleared state after sign-out, not a visual owner publication acceptance.

Existing editor model and private preview suites: 14 passed. Both changed JavaScript files pass syntax checks.

## Preserved contracts and remaining gaps

- Shared design `save` remains private; publication still requires a saved draft, faithful preview, confirmation, exact workspace/listing/request/action/version receipt and current server authorization.
- No SQL, tenant policy, owner-clear precedence or canonical renderer changed. Creator canonical and private preview still use the same creator renderer; populated/sparse authenticated creator publication was not exercised here.
- Business content save is immediately public whereas design save is private. A combined staged-content review/publish workflow remains an earlier open product gap; this correction does not relabel it as implemented.
- No customer account was used to execute actual save → preview → publish → fresh public read. This candidate supplies controlled mounted lifecycle evidence and existing contract coverage, not production authenticated completion.
- Provider publishing, creator monetization and website-first managed intake remain separate outstanding scope. No external account connection or payment capability was added.

Candidate only. No stage, deployment, publication or private database mutation performed by this lane.
