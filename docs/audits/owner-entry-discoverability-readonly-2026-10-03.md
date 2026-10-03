# Current owner entrypoints: read-only audit

Actual live `www.zoi.city` shell, navigation, Business home, Operations and Company dashboard bytes all match committed `95d63fd15b18d3d73d91bb2a5e40ae54313e8a39`. Five exact bindings are in `evidence/owner-entry-discoverability-readonly-2026-10-03/base-binding.json`.

## Website / source review

1. Open `/social/`, sign in, and select the correct authorized workspace in the top-left workspace selector.
2. On phone, first open **Open workspace navigation**. Under **Your public home**, choose **Business home**. Searching **website** in **Find a tool** reveals the same tool.
3. Choose an owned listing when this workspace contains multiple homes. Scroll to **Page details** → **Website**. The editor route is `/social/bizpage?workspace=<workspace UUID>&listing=<listing UUID>`.
4. **Design your home** in the workspace header opens the same editor with its design panel expanded; it does not create a separate website editor. Page details remains in that home editor.
5. The reviewed, frozen source-health candidate places **Website and source review** immediately after the Website/Hours row. **Review website address** focuses the URL input; **Use saved choice** restores the saved owner choice; **Remove website link** only changes the draft, and **Save page** publishes through the existing writer. These candidate owner journeys are retained separately in the source-health freeze; they are not current authenticated production acceptance.

Current production has **no new source-review panel**: its Business home module does not import `source-health.mjs`, and the live module URL returns 404. There is no dedicated **Website** sidebar item; the current public-home tool is named **Business home**. This is terminology/discoverability, not a missing editor.

A concrete current accessibility gap remains: the visible Website label is not associated with its input (`getByLabel('Website')` returns zero at both widths). The first semantic journey failure is retained in `first-semantic-failure.json`; a second journey used the visible Website field without changing the source. The already frozen source-health Business home candidate adds **Official website address** as its accessible name.

## Company work queue / handover

1. In the same authorized workspace, open **Business operations** → **Company administration**. Search **company** in **Find a tool** as a shortcut. Direct entry: `/social/operations?workspace=<workspace UUID>`.
2. Choose **Open company →** on the client’s company card. The company workspace shows **Projects**, **Work & deadlines**, **People** and company-record information.
3. **Work & deadlines** offers **Search saved work**, **Show** (including overdue), **Team member**, and **Open task · <title>**. Choosing a task opens its existing record editor; permissions remain enforced.
4. For a shareable in-workspace destination, use **Open company workspace**. This changes the route to `/social?workspace=<workspace UUID>#operations/company/<company UUID>` while retaining the correct workspace.
5. Select **Check company document records** to load actual permitted project-document metadata and versions. **Export company records** downloads the scoped JSON handover packet. It exports team records and document metadata; it does not transfer the business, send the packet, download file contents, or submit registration/legal filings.

Both widths independently exercised the live shell and live module bytes with explicitly controlled owner snapshots, read-only RPC receipts and mutations denied. They opened Business home through tool search, opened Company administration through tool search, filtered overdue work, navigated to the exact company route, checked document versions, and downloaded a handover containing Olive Studios and version 2 of its agreement while excluding the other company’s School programme. No fixture writes or production writes occurred; no page errors. These are consumer/render journeys with controlled ownership, not an actual signed-in customer production session.

## Discoverability gaps and truthful claims

The current navigation keywords find **website** and **company**, but **source**, **review**, **handover**, **export**, and **work queue** find no tool. Add these to the existing tool metadata during the lead-owned coherent navigation release; a second operating suite is unnecessary. The new review panel is currently unreleased, so announcing it as live would be misleading. Current Company UI distinguishes recorded registration details from verified filings and document records from file contents; no contradictory government-provider or sending claim was observed.

## Evidence

`complete-readonly/report.json` and screenshots distinguish four actual signed-out public URL gates (Website/Company ×390/1440) from two controlled signed-in navigation flows using exact live module bytes. `corrected/` retains the earlier read-only pass without the explicit company-route/download steps; the original folder retains the first missing-label failure. The source-health candidate’s separate frozen audit/evidence remains unchanged. No runtime file was modified in this audit.

Replay without overwriting retained evidence: `QA_OUTPUT_DIR=/tmp/owner-entry-parent NODE_PATH=$PWD/node_modules node tests/browser/owner-entry-discoverability-readonly/verify.cjs`.
