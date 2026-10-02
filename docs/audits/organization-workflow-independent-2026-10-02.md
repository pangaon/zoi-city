# Organization workflow independent review — 2026-10-02

Reviewed frozen packet and source contracts from `organization-workflow-2026-10-02.md`, including the new Contacts wrapper and narrow Audience, Operations, Documents and route changes. No implementation edits or production writes.

Fresh actual Social controlled journeys passed at 390 and 1440: Audience dirty-tab cancellation, Work contact → linked project → assigned task, ambiguous task response and exact recovery, project-scoped document versions 1 and 2, reopen/reload/history, malformed project intent recovery and current viewer restrictions. Eight held-import/upload account/ancestor ownership cases also passed. Fourteen route/navigation units passed. Logs `/tmp/organization-workflow-verify-independent.log`, `/tmp/organization-workflow-ownership-independent.log`, `/tmp/organization-workflow-units-independent.log`.

Source checks: Audience and Operations stores remain explicitly distinct; the wrapper does not infer consent or copy identities. Linked records use existing record writers/recovery. Project routes validate UUID intent, preserve selected workspace and obtain current records. Document list/history checks reject mismatched requested project/document and mismatched supplied workspace; missing/archived context offers a deliberate authorized-project chooser. Actual upload uses the existing private file client and writer, not an invented provider. Role and account/surface scope guards remain in the existing underlying clients. Documents now clears detached captured DOM on disposal.

Visually inspected `/tmp/organization-workflow-390.png`: actual project heading, Back to project action, version-two document card and upload form are legible without horizontal form overflow. This is representative phone rendering, not a category-wide design audit.

No release-blocking defect found in the reviewed new workflow. Remaining usability follow-up reported to producer: Documents internal New/Refresh/other-document actions can discard a dirty selected-file/title draft without the confirmation used by Back to project and shell navigation. This existing internal behavior is not broadened into a claim of complete draft protection.

Acceptance is local implementation/journey evidence. All RPC/file transports are controlled fixtures, not live production authority or storage acceptance. No provider delivery, native-device capability or database deployment is established. Parent owns final exact release and dependency versions; preserve unrelated unreleased service navigation entries.

## Internal draft follow-up closed before release

Parent required the reported Documents draft-loss behavior to be fixed in this packet. Producer added dirty confirmation to New, Refresh and opening another document, and busy navigation refusal. Independent review then caught that confirmed Back would ask twice through local and shell guards; producer clears dirty only after the affirmative local choice before invoking shell navigation.

Final operator SHA256 `3c334f5b171c0bcec83e5b510f8875ecaebff90957e5ab6ba5c9139483b17a13`; final actual-shell fixture `07e9be3fb858b506e0a84b7c1d4f958dbd742a6bb4616288f06856c377488ba5`. Fresh independent full journey passes at 390/1440 with cancelled New/Refresh/Back preserving selected title/file, cancelled document row preserving the next-version file, confirmed New clearing it, and confirmed Back producing exactly one dialog then reaching the exact project. Log `/tmp/organization-workflow-dirty-independent.log`. This supersedes the open internal-draft follow-up above; no release blocker remains in this reviewed packet.
