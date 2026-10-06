# Public experience production acceptance — 6 October 2026

Commit637d70aacc746d7ec45c82f95d3044dc394bc4e8 pushed to main. GitHub CI37407746876 completed success. Vercel production deployment dpl_513fhq71xLfePxjMj4FfKAKXqTg7 is READY for that exact SHA. No second deployment request was required.

Eleven actual www.zoi.city HTML/module/CSS artifact reads match local reviewed SHA256 bytes. Actual production Chromium checked Home, Social, Tickets and Business at390/1440 in light/dark:16 cases passed with no overflow or page exceptions. The homepage hero decoded at3000px natural width. Social stayed public without email/private suite/Auth/database requests; explicit sign-in and Keep exploring returned correctly. Tickets rendered public discovery without OTP/private Studio loading. Business retained useful public content without an email form. Screenshots were visually inspected. This is a bounded browser run, not physical iOS/Android acceptance or real-user Core Web Vitals.

Two initial production harness runs wrongly required #zoiCta / Join Zoi in Business, whose existing header has no account CTA. That locator assumption was corrected against source; Business acceptance instead verifies public H1 and no email gate. This is not hidden as a repaired product defect. Global account navigation checks apply to the actual home/social/tickets headers.

Database API incident remains unresolved. Search and listing calls return503/PGRST002; event directory shows unavailable/retry, rather than pretending empty data is success. Featured event links remain usable but room planning is not confirmed inventory. Google OAuth remains hidden/unaccepted. No payment, reservation, provider publishing or full authenticated-suite transaction was performed by these production checks.

Separate read-only resource run37407746912 failed with metrics500, disk utilization500 and health400; disk configuration alone succeeded. It does not establish resource utilization or support a blind restart. Full platform/Ownr/family/native/map recovery remains tracked; this receipt completes only the bounded public entry release.

Evidence: evidence/public-experience-production-2026-10-06 contains exact artifact hashes,16-case browser report, reproducible driver and phone/desktop screenshots. Internal docs are excluded from Vercel deploy artifacts.
