# Company records: actual private-document upload crosses account switch

Scope mapping: recovery-scope.json Ownr-style company records/corporate documents, unified workspaces and role/data isolation. Existing Operations project/matter + Documents suite already provide private file/version/history workflows. No duplicate organization suite or legal filing/signature provider is proposed.

## Reproduction
Controlled actual social/index.html shell loads real assets/suite/documents.js → assets/documents/operator.mjs → client.mjs. Owner selects project, supplies private title/file, starts upload. ensureFresh is held; active actor changes and shell receives focus. Shell correctly removes old surface. Release ensureFresh: old documentClient still constructs multipart request using current token and old file/workspace.

Both390and1440 send old PRIVATE CONTRACT payload under the next actor's fixture bearer99999999-9999-4999-8999-999999999999. Network was intercepted and403returned; no live upload or backend access. A server may deny crossworkspace access, but private data was already submitted under wrong identity; server permissions do not repair this client boundary.

Harness tests/browser/suite-documents-privacy/verify.cjs; baseline /tmp/suite-documents-privacy/findings.json. Absence of module listeners alone was not used as proof: actual shell cleanup was observed and recorded oldDetached=true.

## Proposed shared repair
Own document client/operator and documents suite wrapper lifecycle only. Capture validated actor/workspace scope before private reads and file selection; check again after ensureFresh and before raw fetch and subsequent response/body processing. Abort inactive request/UI processing, return mount cleanup through wrapper, clear active privateDOM after authorization denial, revoke generated download blobs. Retain current upload request IDs, versionCAS, receipt validation and attachment-only download semantics. Test positive sameaccount file/version/history plus held refresh/upload/download, account/workspace changes, missing identity and denial.

## Other original scope status
Existing document storage is not corporate formation, legally reviewed templates, electronic signature execution, shareholder register, tax/filing advice or connected government filing. These remain separate original scope items requiring real provider/record contracts. Programs/volunteers and organization calendars are distinct nonprofit operations, not substitutes for Ownr-style administration. No implementation edits yet pending exact ownership.

## Implemented local correction
Document client fails closed without explicit active scope; checks before/after auth refresh, response and downloaded body. Operator captures validated actor/workspace, checks connected owned surface and current actor before private RPC/raw actions, clears on current authorization denial, revokes download blob URLs and observes detachment/auth events. Wrapper returns mount cleanup. Existing request ID and version-CAS payloads remain unchanged; an already-sent request is not claimed to be cancelled.

15 unit tests pass including existing file/edge validation and focused preflight/body-parse boundaries. Actual-shell390/1440 controlled journeys exercise queued upload/account switch (no wrongactor transport), sameaccount upload→versionhistory→real attachment download,403denial/privateclear and missing/opaqueactor zero-private-RPC. Old shell surface cleanup still works. No provider/live file upload occurs. Findings /tmp/suite-documents-privacy/findings.json. Independent review and root cache/deployment remain pending.
