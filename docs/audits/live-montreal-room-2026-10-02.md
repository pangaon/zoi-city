# Live Montréal room check — 2026-10-02

At 14:01 UTC the canonical Montréal event route returned HTTP 200, while the Yamas canonical business route returned HTTP 503. Explore HTML returned 200; that alone does not establish live search suggestions or profile read availability. Backend recovery remains incomplete.

A real Chromium browser at 390 and 1440 pixels loaded the deployed Montréal canonical event route with #room, which automatically mounts the room. Both widths rendered a canvas and 102 table-number controls, allowed finding and selecting table 10A, updated the preference and enabled the corresponding continuation, and switched to the view from table. No page errors were observed in either bounded journey.

An initial verifier attempted to click the entry button while #room was already auto-mounting and hid that button; it timed out. The corrected journey awaited the canvas, consistent with the actual route behavior. No runtime edit was needed.

Retained evidence: `docs/audits/evidence/live-montreal-2026-10-02/`. The root visually inspected the phone screenshot. It proves current deployed room interaction, not complete art-direction acceptance, all orbit angles, booking, table holds, payments or source-wide acceptance. The room remains an illustration and table selection a preference. No guest booking or customer mutation was performed.
