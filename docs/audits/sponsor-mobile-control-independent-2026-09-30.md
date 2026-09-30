# Mobile sponsor controls — independent review

Candidate changes only venue-experience.css and its Toronto HTML version reference.
Specialist exercised 16 normal/fullscreen/open/closed states at390×844,430×932,844×390,932×430 with production HTML/JS and the candidate stylesheet intercepted locally. Closed chips stayed compact, with no overlap against the selected-table inspector.

Root independently exercised390×844 and844×390 fullscreen, selected table17, opened the actual preview card, then opened table details. The actual card was scrollable and did not intersect the booking action; opening details closed sponsorship. Screenshot /tmp/sponsor-independent-390.png was visually inspected. This verifies candidate rendering, not a deployed change or real sponsorship.

Browser CLI was unavailable, so the existing pinned Playwright browser was used. No messages, purchases, reservations or sponsor approvals were submitted.
