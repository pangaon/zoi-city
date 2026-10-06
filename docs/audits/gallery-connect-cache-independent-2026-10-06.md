# Independent cache-binding derivative review

PASS bounded source review. Compared all13 derivative files against this integration tree's HEAD after normalizing only ?v= version tokens: every file is otherwise byte-equivalent. No renderer data, role logic, copy, mutation behavior or preload changes are introduced by this derivative. All12 accepted gallery manifest files and accepted Connect runtime are byte-identical to their independently reviewed producer trees.

Effective canonical chains:

-Restaurant and bakery API HTML → respective client.mjs?v=20261006-gallery → shared gallery helper.
-Hospitality API HTML → hospitality/client.mjs?v=20261006-gallery → helper.
-Music API HTML → music/app.mjs?v=20261006-gallery → helper.
-Creator API HTML → creator/canonical.mjs?v=20261006-gallery → client.mjs?v=20261006-gallery → helper.
-Event API HTML → events/canonical.mjs?v=20261006-gallery → client.mjs?v=20261006-gallery → helper.
-Church API HTML → church/canonical.mjs?v=20261006-gallery → mount.mjs?v=20261006-gallery → helper. Church app's mount import is also updated.
-Generic entity HTML → experience.mjs?v=20261006-gallery → helper.

Every helper import and its CSS reference is versioned20261006. Connect remains an inert application/json data-suite-src entry; only its URL version changes to20261006-owner-refresh. It is not converted into an eager script or public private-tool preload. Server renderer module imports are unchanged, avoiding the previously identified server bundler query-import hazard.

No missing binding found for these eight canonical gallery entry paths. This does not prove cache freshness for unrelated historical showcase HTML that references an older church app URL, nor does it substitute for production smoke checks. Lead is running the combined42-case canonical browser suite/shared/Connect/verify:local; prior independent gallery and Connect journey receipts remain separate. This reviewer made no runtime edits and performed no backend/provider operations. Exact derivative hashes: evidence/gallery-connect-cache-independent-2026-10-06/manifest.json.
