# Claim workspace handoff independent review

Accepted narrow UI candidate, conditional on separately reviewed backend scoped-receipt/authorization migration. Do not deploy the UI alone against legacy claim RPC responses.

Hashes: assets/suite/bizpage.js `5f07c5623b6aaf72d7286f75389749714458e5439f63bc6c27cd9785c49715c3`; explore/index.html `e3ecbf739189ed91a725904588702c9ac85ee0e19befe2622b29848e1397a065`.

Source: active Business home workspace is preserved in Explore intent and through filter URL rewriting. Exactly one valid currently authorized owner/admin workspace can be preselected. Invalid/duplicate/unauthorized intent requires an explicit authorized selection, with no silent saved-workspace substitution. Before submission a fresh membership read and unchanged account token are required. The public listing ID, selected workspace ID and claim UUID must bind the success receipt. Only settled claimed status yields an exact listing editor URL; pending yields a workspace URL and states editing remains locked. Unknown outcomes keep submission disabled rather than invite a blind retry.

Independent actual Explore/Business home browser harness with controlled RPCs passed390/1440: selected-workspace round trip, pending versus settled destinations, viewer exclusion, duplicate intent, wrong-scope response, role downgrade and account changes while membership/claim responses are held. Existing exact owner-listing intent regression also passed390/1440. Logs /tmp/claim-handoff-independent.log and /tmp/claim-owner-listing-independent.log. Phone screenshot /tmp/zoi-claim-handoff-390.png inspected: selector, submit, dialog actions and explanatory copy fit legibly.

No customer claims or ownership mutations were performed. These are real UI/controller tests with controlled backend transport, not proof of production ownership authorization. Prior backend audit defects remain a release dependency until corrected and independently tested: role, current verified identity, listing ownership/public visibility, serialized competing claims and resolver authority. Browser checks are not that security boundary.

Logged-out flow still navigates to /social without durable return-to-claim intent, and full pending-claim tracking is absent. They are explicit remaining scope; the patch does not claim to complete those journeys.
