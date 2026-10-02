# Contact reuse, phone room controls and public profile request coalescing

The exact staged code tree `73143f871aed155f914f877e9a8fa2caa86df945`
was exported to `/tmp/zoi-contact-room-load-release-d5cmqs08`. The final
commit also contains documentation updates; no further runtime edits follow
these checks. Exact code hashes are retained in
`evidence/contact-room-load-staged-2026-10-02.json`.

## Changed behavior

- An explicitly opened host picker reuses names from the authorized workspace's
  Operations Contacts, preserving whole-ticket quantities. Selection fills an
  editable name; it does not turn a CRM record into a signed-in identity. The
  separate Contacts & audience store remains outside this picker.
- Phone room artwork starts beneath measured room controls. Toronto sponsor
  entry remains outside the art area; an explicitly opened detail card can
  overlay the scene. Both room families retain their source-specific furniture.
- Simultaneous anonymous requests for the same profile share in-flight public
  reads. Twelve controlled same-slug requests drop from 36 reads to three.
  Settled results and errors are immediately evicted; no new result TTL hides
  owner clears. This does not establish database recovery.

## Evidence

`npm run verify:local` passed: 278 node:test files and two standalone suites.
The staged actual host browser journeys passed at 390 and 1440 pixels, covering
keyboard search/selection, quantities, failed and empty reads, retained drafts,
wrong scopes, held refreshes and detached surfaces. Independent contact scope
checks passed at both widths. Four staged paired room control journeys passed.
The independent source and journey audits for each packet are included.

Production deployment and actual public journeys must be recorded separately
after push. Authenticated contact checks use controlled authorized fixtures;
no customer contact was imported or message sent. Montréal's current canonical
backend 503 remains open. Service migrations, organizer service surfaces and
unreviewed payment-policy work are excluded from this release.
