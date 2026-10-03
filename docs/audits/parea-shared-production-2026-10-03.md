# Shared Parea production acceptance — prepared, awaiting release

The candidate remains frozen in manifest c648135b0caf700675dacdbf0d95b22ba262eeb61b923a18112a319bbc82c406. This separate runner checks actual production bytes and journeys after the parent confirms the exact ready release. No candidate overlay, API fixture, authentication, message send, hold, payment or data mutation is used.

`tests/browser/parea-shared-production/verify.cjs` covers ordinary Toronto, Montréal and real sparse Kalamata choir festival canonical pages at 390 and 1440. It compares the eight served Parea runtime files against the parent's exact staged/archive bytes, retaining both hashes; reviewed version-binding derivatives may be supplied through PAREA_ASSET_BASE. Browser requests use their real versioned URLs and responses. A narrow request gate refuses accidental writes while allowing the existing public read RPCs.

The planned journey opens source table 9 or 10A in the actual room and continues into the same planner, assigns 3/1/5 whole tickets, confirms optional contact details, reviews an individual invitation, and inspects exact SMS/mailto encoding without opening the composers. The message and decoded mail subject/body must preserve the exact Unicode public event title. Toronto's source subtotal remains $1,800; Montréal and the sparse festival retain unknown pricing. Actual inventory replies must match the event UUID and remain unconfigured, with no tables; a configured reply is a changed source condition requiring review rather than silently converting this check into a booking pass. The host link must retain the exact event context. Anonymous saved crew access must request sign-in.

The read-only source selection in `docs/audits/evidence/parea-shared-production-2026-10-03/sparse-source-selection.json` found canonical public HTTP 200 for Kalamata International Choir Competition and Festival, ID 013e2e23-c8cd-4a27-8036-13df80a109ba. Its actual generic public content has empty starts, venue, hero, floor-plan, website and contact URL. Omodos Wine Festival is retained as a second sparse selection; it is not part of this runner. This selection is evidence of source sparsity, not a released planner journey or current official-source verification.

Run only after the parent confirms production READY:

```bash
PAREA_EXPECTED_COMMIT=<exact ready 40-character commit> \
PAREA_DEPLOY_READY=<same commit> \
PAREA_ASSET_BASE=<parent exact staged/archive directory> \
QA_OUTPUT_DIR=<new distinct evidence directory> \
NODE_PATH=$PWD/node_modules \
node tests/browser/parea-shared-production/verify.cjs
```

The report records HTML hashes, exact served asset hashes, source identity, read RPC status/timing, each opened contact and review screen, inventory truth, errors, failed requests and any refused write. Credential scanning runs before saving the report. Syntax and source scanning passed during preparation; production acceptance remains pending. No runtime file or previous frozen fixture was edited by this follow-up.
